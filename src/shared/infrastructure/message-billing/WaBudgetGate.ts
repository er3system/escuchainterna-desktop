import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { getUserLimitOverrides } from '../billing-overrides/UserLimitOverrides';
import { writeOutboxMessage } from '../outbox/OutboxWriter';
import type { OutboxMessageInput } from '../outbox/OutboxWriter';
import { isDesktopEdition } from '../config/desktopEdition';

/**
 * Puerta de presupuesto de mensajes WhatsApp por plan (v3-spec §5).
 *
 * Cuenta los WhatsApp del mes calendario en el outbox del dueño y los compara
 * con `plans.wa_monthly_limit` (esencial 100 / profesional 1500 / organización
 * 800; NULL = sin límite). Reglas de resolución del plan:
 *
 * - Suscripción del dueño; sin suscripción propia (miembro cubierto por su
 *   organización) → se trata como `profesional`.
 * - Administradores: sin límite.
 *
 * Al exceder el límite los notifiers NO escriben el WhatsApp: en su lugar
 * queda un registro con status 'omitido' y una nota ("límite del plan"), y el
 * correo sale igual — todo sigue funcionando, solo cambia el canal. Los
 * registros 'omitido' no cuentan contra el límite.
 */

export interface WaBudget {
  /** Límite mensual del plan; null = sin límite. */
  limit: number | null;
  /** WhatsApp registrados (no omitidos) en el mes calendario en curso. */
  used: number;
  /** true cuando ya no se pueden registrar más WhatsApp este mes. */
  exceeded: boolean;
  plan: string;
}

export interface WaWriteResult {
  /** true si el WhatsApp se registró como enviado; false si se omitió por límite del plan. */
  sent: boolean;
  /** Id del registro en el outbox (enviado u omitido). */
  id: string;
}

/** Nota que acompaña a todo registro 'omitido' (límite del plan). */
export const WA_OMITTED_NOTE =
  '[No enviado por WhatsApp: límite del plan este mes — el aviso salió por correo]';

/**
 * Valores por defecto del esquema v8. La migración v8 los fija en BDs
 * existentes, pero en una BD nueva el seed inserta los planes DESPUÉS de las
 * migraciones (con wa_monthly_limit NULL), así que este módulo aplica un pase
 * único de respaldo (marker en platform_settings) que no pisa ajustes
 * posteriores del admin.
 */
const DEFAULT_WA_MONTHLY_LIMITS: Record<string, number> = {
  esencial: 100,
  profesional: 1500,
  organizacion: 800,
};

const BACKFILL_MARKER = 'wa_limits_backfill';

/** Idempotente: fija los límites por defecto SOLO donde siguen en NULL, una vez. */
export async function ensureDefaultWaMonthlyLimits(): Promise<void> {
  const db = getDatabaseAdapter();
  const marker = await db.queryRow<{ key: string }>(
    'SELECT key FROM platform_settings WHERE key = ?',
    [BACKFILL_MARKER],
  );
  if (marker) return;
  for (const [planId, limit] of Object.entries(DEFAULT_WA_MONTHLY_LIMITS)) {
    await db.execute('UPDATE plans SET wa_monthly_limit = ? WHERE id = ? AND wa_monthly_limit IS NULL', [
      limit,
      planId,
    ]);
  }
  await db.execute('INSERT INTO platform_settings (key, value_json) VALUES (?, ?) ON CONFLICT DO NOTHING', [
    BACKFILL_MARKER,
    JSON.stringify({ appliedAt: new Date().toISOString() }),
  ]);
}

/** Rango [inicio, fin) del mes calendario (UTC, como los `created_at` ISO). */
function monthRange(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { start, end };
}

/** WhatsApp del dueño en el mes calendario en curso (los 'omitido' no cuentan). */
export async function countMonthWhatsapp(ownerUserId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = monthRange(now);
  const row = await getDatabaseAdapter().queryRow<{ total: number }>(
    `SELECT COUNT(*) AS total
         FROM outbox_messages
        WHERE owner_user_id = ? AND channel = 'whatsapp' AND status <> 'omitido'
          AND created_at >= ? AND created_at < ?`,
    [ownerUserId, start, end],
  );
  return row ? Number(row.total) : 0;
}

/** Presupuesto de WhatsApp del dueño para el mes en curso. */
export async function resolveWaBudget(ownerUserId: string, now: Date = new Date()): Promise<WaBudget> {
  await ensureDefaultWaMonthlyLimits();
  const used = await countMonthWhatsapp(ownerUserId, now);

  if (isDesktopEdition()) {
    return { limit: null, used, exceeded: false, plan: 'local' };
  }

  const db = getDatabaseAdapter();
  const user = await db.queryRow<{ role: string }>('SELECT role FROM users WHERE id = ?', [ownerUserId]);
  if (user && user.role === 'admin') {
    return { limit: null, used, exceeded: false, plan: 'admin' };
  }

  const subscription = await db.queryRow<{ plan: string }>(
    'SELECT plan FROM subscriptions WHERE user_id = ?',
    [ownerUserId],
  );
  // Sin suscripción propia = miembro cubierto por su organización → profesional.
  const planId = subscription ? subscription.plan : 'profesional';
  const row =
    (await db.queryRow<{ wa_monthly_limit: number | null }>(
      'SELECT wa_monthly_limit FROM plans WHERE id = ?',
      [planId],
    )) ??
    (await db.queryRow<{ wa_monthly_limit: number | null }>(
      'SELECT wa_monthly_limit FROM plans WHERE id = ?',
      ['profesional'],
    ));

  const planLimit =
    row && row.wa_monthly_limit !== null && row.wa_monthly_limit !== undefined
      ? Number(row.wa_monthly_limit)
      : null;
  // Override por cuenta (v27): si está presente, pisa al límite del plan.
  const override = (await getUserLimitOverrides(ownerUserId)).waMonthlyLimit;
  const limit = override ?? planLimit;
  return { limit, used, exceeded: limit !== null && used >= limit, plan: planId };
}

/**
 * Escribe un WhatsApp al outbox respetando el presupuesto del plan del dueño.
 * Si el límite del mes ya se alcanzó, NO se registra el envío: queda un
 * registro con status 'omitido' y la nota del límite (el notifier que llama
 * decide el canal alterno — normalmente el correo, que sale igual).
 *
 * Tolerante a fallos: si la resolución del presupuesto falla por cualquier
 * razón, el mensaje se escribe normal (una notificación nunca debe romper la
 * operación que la origina).
 */
export async function writeWhatsappOrOmit(
  input: Omit<OutboxMessageInput, 'channel'>,
): Promise<WaWriteResult> {
  let exceeded = false;
  if (input.ownerUserId) {
    try {
      exceeded = (await resolveWaBudget(input.ownerUserId)).exceeded;
    } catch {
      exceeded = false;
    }
  }

  if (!exceeded) {
    return { sent: true, id: await writeOutboxMessage({ ...input, channel: 'whatsapp' }) };
  }

  // Registro 'omitido': deja constancia visible en /mensajes sin "enviar" nada
  // (sent_at NULL) y sin consumir presupuesto.
  const id = randomUUID();
  const now = new Date().toISOString();
  await getDatabaseAdapter().execute(
    `INSERT INTO outbox_messages
        (id, channel, recipient, recipient_name, template, subject, body, status, booking_id, patient_id, owner_user_id, created_at, sent_at)
       VALUES (?, 'whatsapp', ?, ?, ?, ?, ?, 'omitido', ?, ?, ?, ?, NULL)`,
    [
      id,
      input.recipient,
      input.recipientName ?? '',
      input.template,
      input.subject ?? '',
      `${WA_OMITTED_NOTE}\n\n${input.body}`,
      input.bookingId ?? null,
      input.patientId ?? null,
      input.ownerUserId ?? null,
      now,
    ],
  );
  return { sent: false, id };
}
