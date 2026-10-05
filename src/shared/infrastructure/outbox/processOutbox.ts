import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { sendTransactionalEmail } from '../notifications/ResendEmailSender';
import { isDesktopEdition } from '../config/desktopEdition';

/**
 * Worker durable del OUTBOX (re-plataforma 0f). Drena los correos pendientes y
 * vencidos: intenta el envío real (Resend), marca 'enviado' al lograrlo (o si no
 * hay proveedor conectado = modo simulado), y ante un fallo TRANSITORIO re-encola
 * con backoff exponencial hasta MAX_ATTEMPTS, tras lo cual marca 'fallido'.
 *
 * Lo dispara `/api/jobs/run` (un scheduler externo: Cloudflare Cron, etc.). Cierra
 * el hueco de durabilidad de `afterCommit` (que envía en proceso y se pierde ante
 * un crash o un fallo transitorio del proveedor). SQL portable (SQLite + Postgres).
 *
 * Nota de concurrencia: modelo de UN worker por tick (el scheduler no solapa
 * corridas). Para varios workers en paralelo haría falta reclamar filas con
 * `FOR UPDATE SKIP LOCKED` (Postgres) — refinamiento posterior.
 */

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 60_000; // 1 min
const MAX_BACKOFF_MS = 6 * 60 * 60_000; // 6 h

/** Backoff exponencial por intento (1m, 5m, 25m, … con tope de 6h). */
export function outboxBackoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 5 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

interface DueRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  attempts: number;
  owner_user_id?: string;
}

export interface OutboxDrainResult {
  processed: number;
  sent: number;
  requeued: number;
  failed: number;
}

export async function processOutbox(limit = 50, ownerUserId?: string): Promise<OutboxDrainResult> {
  const db = getDatabaseAdapter();
  if (isDesktopEdition() && !ownerUserId) throw new Error('El reintento local necesita una cuenta en sesión.');
  const nowIso = new Date().toISOString();
  const due = await db.query<DueRow>(
    `SELECT id, recipient, subject, body, attempts, owner_user_id FROM outbox_messages
      WHERE channel = 'email' AND status = 'pendiente'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ${ownerUserId ? 'AND owner_user_id = ?' : ''}
      ORDER BY (next_attempt_at IS NULL) DESC, next_attempt_at ASC
      LIMIT ?`,
    [nowIso, ...(ownerUserId ? [ownerUserId] : []), limit],
  );

  const result: OutboxDrainResult = { processed: 0, sent: 0, requeued: 0, failed: 0 };

  for (const row of due) {
    if (isDesktopEdition()) {
      const claimed = await db.queryRow<{ id: string }>(`UPDATE outbox_messages SET next_attempt_at = ?
        WHERE id = ? AND status = 'pendiente' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) RETURNING id`,
        [new Date(Date.now() + 120_000).toISOString(), row.id, nowIso]);
      if (!claimed) continue;
    }
    result.processed += 1;
    let reason: string | undefined;
    try {
      const sendResult = await sendTransactionalEmail({
        to: row.recipient,
        subject: row.subject,
        body: row.body,
      }, row.owner_user_id);
      reason = sendResult.reason;
    } catch (error) {
      reason = error instanceof Error ? error.message : 'error_desconocido';
    }

    // Éxito real o "sin_proveedor" (modo simulado de dev) → enviado.
    if (reason === 'sin_proveedor' && isDesktopEdition()) {
      await db.execute("UPDATE outbox_messages SET status = 'omitido', sent_at = NULL, next_attempt_at = NULL WHERE id = ?", [row.id]);
      continue;
    }
    if (!reason || reason === 'sin_proveedor') {
      await db.execute(
        `UPDATE outbox_messages SET status = 'enviado', sent_at = ?, next_attempt_at = NULL WHERE id = ?`,
        [new Date().toISOString(), row.id],
      );
      result.sent += 1;
      continue;
    }

    // Fallo transitorio del proveedor: reintento con backoff, o 'fallido' al agotar.
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db.execute(`UPDATE outbox_messages SET status = 'fallido', attempts = ? WHERE id = ?`, [
        attempts,
        row.id,
      ]);
      result.failed += 1;
    } else {
      const nextAttemptAt = new Date(Date.now() + outboxBackoffMs(attempts)).toISOString();
      await db.execute(
        `UPDATE outbox_messages SET attempts = ?, next_attempt_at = ? WHERE id = ?`,
        [attempts, nextAttemptAt, row.id],
      );
      result.requeued += 1;
    }
  }

  return result;
}
