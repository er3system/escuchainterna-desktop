import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Puerta de presupuesto de WhatsApp contra SQLite real (BD temporal, planes
 * del seed + backfill de límites v8):
 * - el límite es mensual por dueño contra `plans.wa_monthly_limit`;
 * - sin suscripción propia → como profesional; admin → sin límite;
 * - al exceder, `writeWhatsappOrOmit` deja un registro 'omitido' (no enviado,
 *   no cuenta contra el límite) con la nota del plan;
 * - los 'omitido', los meses anteriores y otros dueños no consumen presupuesto.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-wa-gate-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolveWaBudget: typeof import('@/shared/infrastructure/message-billing/WaBudgetGate')['resolveWaBudget'];
let countMonthWhatsapp: typeof import('@/shared/infrastructure/message-billing/WaBudgetGate')['countMonthWhatsapp'];
let writeWhatsappOrOmit: typeof import('@/shared/infrastructure/message-billing/WaBudgetGate')['writeWhatsappOrOmit'];
let ensureDefaultWaMonthlyLimits: typeof import('@/shared/infrastructure/message-billing/WaBudgetGate')['ensureDefaultWaMonthlyLimits'];
let WA_OMITTED_NOTE: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  // El catálogo CIE-11 no hace falta para este test (y ralentiza el seed).
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolveWaBudget, countMonthWhatsapp, writeWhatsappOrOmit, ensureDefaultWaMonthlyLimits, WA_OMITTED_NOTE } =
    await import('@/shared/infrastructure/message-billing/WaBudgetGate'));
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function crearUsuario(role: string = 'psychologist'): string {
  const id = randomUUID();
  getDb()
    .prepare(`INSERT INTO users (id, email, password_hash, created_at, role) VALUES (?, ?, 'x', ?, ?)`)
    .run(id, `${id}@test.com`, new Date().toISOString(), role);
  return id;
}

function suscribir(userId: string, plan: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, created_at)
       VALUES (?, ?, ?, 'activa', ?, ?)`,
    )
    .run(randomUUID(), userId, plan, now, now);
}

/** Inserta un whatsapp directo en el outbox (sin pasar por la puerta). */
function whatsappEnviado(ownerUserId: string, createdAt: string = new Date().toISOString()): void {
  getDb()
    .prepare(
      `INSERT INTO outbox_messages
        (id, channel, recipient, recipient_name, template, subject, body, status, owner_user_id, created_at, sent_at)
       VALUES (?, 'whatsapp', '+573001112233', 'Paciente Prueba', 'recordatorio_sesion', 's', 'b', 'enviado', ?, ?, ?)`,
    )
    .run(randomUUID(), ownerUserId, createdAt, createdAt);
}

/** Lleva al dueño exactamente al límite de su plan con whatsapps de este mes. */
function agotarLimite(ownerUserId: string, limit: number): void {
  for (let i = 0; i < limit; i += 1) whatsappEnviado(ownerUserId);
}

function mesAnteriorIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12)).toISOString();
}

async function fijarLimite(planId: string, limit: number): Promise<void> {
  await ensureDefaultWaMonthlyLimits();
  getDb().prepare('UPDATE plans SET wa_monthly_limit = ? WHERE id = ?').run(limit, planId);
}

function leerMensaje(id: string): { status: string; body: string; sent_at: string | null; channel: string } {
  return getDb()
    .prepare('SELECT status, body, sent_at, channel FROM outbox_messages WHERE id = ?')
    .get(id) as { status: string; body: string; sent_at: string | null; channel: string };
}

describe('WaBudgetGate — resolución del presupuesto', () => {
  it('backfill v8: los planes del seed quedan con sus límites por defecto', async () => {
    await ensureDefaultWaMonthlyLimits();
    const rows = getDb()
      .prepare(`SELECT id, wa_monthly_limit FROM plans WHERE id IN ('esencial', 'profesional', 'organizacion')`)
      .all() as unknown as Array<{ id: string; wa_monthly_limit: number | null }>;
    const limites = new Map(rows.map((row) => [row.id, row.wa_monthly_limit]));
    expect(limites.get('esencial')).toBe(100);
    expect(limites.get('profesional')).toBe(1500);
    expect(limites.get('organizacion')).toBe(800);
  });

  it('el backfill NO pisa un límite ajustado por el admin (marker de una sola vez)', async () => {
    await ensureDefaultWaMonthlyLimits();
    getDb().prepare(`UPDATE plans SET wa_monthly_limit = NULL WHERE id = 'organizacion'`).run();
    await ensureDefaultWaMonthlyLimits();
    const row = getDb()
      .prepare(`SELECT wa_monthly_limit FROM plans WHERE id = 'organizacion'`)
      .get() as { wa_monthly_limit: number | null };
    expect(row.wa_monthly_limit).toBeNull();
    // Restaurar para el resto de la suite.
    getDb().prepare(`UPDATE plans SET wa_monthly_limit = 800 WHERE id = 'organizacion'`).run();
  });

  it('cuenta solo los whatsapp del MES en curso del propio dueño', async () => {
    const userId = crearUsuario();
    const otro = crearUsuario();
    whatsappEnviado(userId);
    whatsappEnviado(userId, mesAnteriorIso());
    whatsappEnviado(otro);

    expect(await countMonthWhatsapp(userId)).toBe(1);
  });

  it('bajo el límite: no excedido, con plan y contador correctos', async () => {
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    whatsappEnviado(userId);

    const budget = await resolveWaBudget(userId);
    expect(budget.plan).toBe('esencial');
    expect(budget.limit).toBe(100);
    expect(budget.used).toBe(1);
    expect(budget.exceeded).toBe(false);
  });

  it('sin suscripción propia (miembro cubierto por su organización) → como profesional', async () => {
    const userId = crearUsuario();
    const budget = await resolveWaBudget(userId);
    expect(budget.plan).toBe('profesional');
    expect(budget.limit).toBe(1500);
  });

  it('admin → sin límite, nunca excedido', async () => {
    const adminId = crearUsuario('admin');
    agotarLimite(adminId, 5);
    const budget = await resolveWaBudget(adminId);
    expect(budget.plan).toBe('admin');
    expect(budget.limit).toBeNull();
    expect(budget.exceeded).toBe(false);
  });
});

describe('WaBudgetGate — writeWhatsappOrOmit (decisión de canal)', () => {
  it('bajo el límite: registra el whatsapp como enviado', async () => {
    const userId = crearUsuario();
    suscribir(userId, 'esencial');

    const result = await writeWhatsappOrOmit({
      recipient: '+573001112233',
      recipientName: 'Paciente Prueba',
      template: 'recordatorio_sesion',
      subject: 'Recordatorio',
      body: 'Tu sesión es mañana.',
      ownerUserId: userId,
    });

    expect(result.sent).toBe(true);
    const row = leerMensaje(result.id);
    expect(row.channel).toBe('whatsapp');
    expect(row.status).toBe('enviado');
    expect(row.sent_at).not.toBeNull();
  });

  it('al exceder el límite del plan: queda un registro «omitido» con la nota, sin enviarse', async () => {
    await fijarLimite('esencial', 2);
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    agotarLimite(userId, 2);

    const result = await writeWhatsappOrOmit({
      recipient: '+573001112233',
      recipientName: 'Paciente Prueba',
      template: 'recordatorio_pago',
      subject: 'Pago pendiente',
      body: 'Tienes un pago pendiente.',
      ownerUserId: userId,
    });

    expect(result.sent).toBe(false);
    const row = leerMensaje(result.id);
    expect(row.status).toBe('omitido');
    expect(row.sent_at).toBeNull();
    expect(row.body).toContain(WA_OMITTED_NOTE);
    expect(row.body).toContain('Tienes un pago pendiente.');
    await fijarLimite('esencial', 100);
  });

  it('los registros «omitido» NO consumen presupuesto (el contador no crece)', async () => {
    await fijarLimite('esencial', 1);
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    agotarLimite(userId, 1);

    await writeWhatsappOrOmit({
      recipient: '+57300',
      template: 'recordatorio_sesion',
      body: 'a',
      ownerUserId: userId,
    });
    await writeWhatsappOrOmit({
      recipient: '+57300',
      template: 'recordatorio_sesion',
      body: 'b',
      ownerUserId: userId,
    });

    expect(await countMonthWhatsapp(userId)).toBe(1);
    const omitidos = getDb()
      .prepare(
        `SELECT COUNT(*) AS total FROM outbox_messages WHERE owner_user_id = ? AND status = 'omitido'`,
      )
      .get(userId) as { total: number };
    expect(Number(omitidos.total)).toBe(2);
    await fijarLimite('esencial', 100);
  });

  it('los whatsapp de meses anteriores no cuentan: el mes nuevo vuelve a enviar', async () => {
    await fijarLimite('esencial', 1);
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    whatsappEnviado(userId, mesAnteriorIso());

    const result = await writeWhatsappOrOmit({
      recipient: '+57300',
      template: 'recordatorio_sesion',
      body: 'mes nuevo',
      ownerUserId: userId,
    });
    expect(result.sent).toBe(true);
    await fijarLimite('esencial', 100);
  });

  it('sin ownerUserId (mensaje de plataforma): se envía sin pasar por el presupuesto', async () => {
    const result = await writeWhatsappOrOmit({
      recipient: '+57300',
      template: 'recuperar_contrasena',
      body: 'liga de recuperación',
    });
    expect(result.sent).toBe(true);
    expect(leerMensaje(result.id).status).toBe('enviado');
  });
});
