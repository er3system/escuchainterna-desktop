import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Puerta de presupuesto de IA contra SQLite real (BD temporal, planes del seed):
 * - esencial: modelo económico siempre; tope DURO mensual → bloqueo amable.
 * - profesional: premium bajo el umbral suave; económico (en silencio) al superarlo.
 * - sin suscripción (miembro de organización cubierto) → como profesional.
 * - admin → premium sin límites.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-ai-gate-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolveAiAccess: typeof import('@/shared/infrastructure/ai-billing/AiBudgetGate')['resolveAiAccess'];
let sumMonthSpentCop: typeof import('@/shared/infrastructure/ai-billing/AiBudgetGate')['sumMonthSpentCop'];
let AI_BUDGET_BLOCKED_MESSAGE: string;
let findPlan: typeof import('@/shared/infrastructure/persistence/PlanCatalog')['findPlan'];
let getAiCosting: typeof import('@/shared/infrastructure/persistence/PlanCatalog')['getAiCosting'];

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  // El catálogo CIE-11 no hace falta para este test (y ralentiza el seed).
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolveAiAccess, sumMonthSpentCop, AI_BUDGET_BLOCKED_MESSAGE } = await import(
    '@/shared/infrastructure/ai-billing/AiBudgetGate'
  ));
  ({ findPlan, getAiCosting } = await import('@/shared/infrastructure/persistence/PlanCatalog'));
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

function gastar(ownerUserId: string, cop: number, createdAt: string = new Date().toISOString()): void {
  getDb()
    .prepare(
      `INSERT INTO ai_usage_events
         (id, owner_user_id, kind, model, input_tokens, output_tokens, est_cost_usd, est_cost_cop, created_at)
       VALUES (?, ?, 'chat', 'claude-haiku-4-5', 1000, 1000, ?, ?, ?)`,
    )
    .run(randomUUID(), ownerUserId, cop / 4200, cop, createdAt);
}

function mesAnteriorIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12)).toISOString();
}

describe('AiBudgetGate — plan esencial (tope duro)', () => {
  it('bajo el tope: permitido y SIEMPRE con el modelo económico', async () => {
    const costing = await getAiCosting();
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(userId, 100);

    const acceso = await resolveAiAccess(userId, 'pregunta_nota');
    expect(acceso.allowed).toBe(true);
    expect(acceso.model).toBe(costing.modeloEconomico);
    expect(acceso.plan).toBe('esencial');
    expect(acceso.monthSpentCop).toBeCloseTo(100, 6);
    expect(acceso.blockedMessage).toBeUndefined();
  });

  it('al alcanzar el tope del mes: bloqueado con mensaje amable', async () => {
    const tope = (await findPlan('esencial'))!.aiMonthlyBudgetCop!;
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(userId, tope / 2);
    gastar(userId, tope / 2);

    const acceso = await resolveAiAccess(userId, 'chat');
    expect(acceso.allowed).toBe(false);
    expect(acceso.blockedMessage).toBe(AI_BUDGET_BLOCKED_MESSAGE);
    expect(acceso.monthSpentCop).toBeCloseTo(tope, 6);
  });

  it('el gasto de meses anteriores NO cuenta: la función vuelve sola al cambiar de mes', async () => {
    const tope = (await findPlan('esencial'))!.aiMonthlyBudgetCop!;
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(userId, tope * 3, mesAnteriorIso());
    gastar(userId, 1);

    expect(await sumMonthSpentCop(userId)).toBeCloseTo(1, 6);
    expect((await resolveAiAccess(userId, 'chat')).allowed).toBe(true);
  });

  it('el gasto de OTRO dueño no afecta el presupuesto propio', async () => {
    const tope = (await findPlan('esencial'))!.aiMonthlyBudgetCop!;
    const userId = crearUsuario();
    const otro = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(otro, tope * 5);

    expect((await resolveAiAccess(userId, 'chat')).allowed).toBe(true);
  });
});

describe('AiBudgetGate — plan profesional (umbral suave, sin tope duro)', () => {
  it('bajo el umbral: modelo premium', async () => {
    const costing = await getAiCosting();
    const userId = crearUsuario();
    suscribir(userId, 'profesional');
    gastar(userId, 50);

    const acceso = await resolveAiAccess(userId, 'reporte_sesion');
    expect(acceso.allowed).toBe(true);
    expect(acceso.model).toBe(costing.modeloPremium);
  });

  it('sobre el umbral: degradación SILENCIOSA al económico, nunca bloqueo', async () => {
    const costing = await getAiCosting();
    const umbral = (await findPlan('profesional'))!.aiSoftBudgetCop!;
    const userId = crearUsuario();
    suscribir(userId, 'profesional');
    gastar(userId, umbral + 1);

    const acceso = await resolveAiAccess(userId, 'reporte_sesion');
    expect(acceso.allowed).toBe(true);
    expect(acceso.model).toBe(costing.modeloEconomico);
    expect(acceso.blockedMessage).toBeUndefined();
  });

  it('sin suscripción propia (miembro cubierto por su organización) → como profesional', async () => {
    const costing = await getAiCosting();
    const userId = crearUsuario();

    const acceso = await resolveAiAccess(userId, 'chat');
    expect(acceso.allowed).toBe(true);
    expect(acceso.plan).toBe('profesional');
    expect(acceso.model).toBe(costing.modeloPremium);
  });
});

describe('AiBudgetGate — ruteo por tarea (kinds premium-siempre, v3-spec §5)', () => {
  it('esencial + sugerencias_historia: premium aunque el plan sea de modelo económico', async () => {
    const costing = await getAiCosting();
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(userId, 1);

    const acceso = await resolveAiAccess(userId, 'sugerencias_historia');
    expect(acceso.allowed).toBe(true);
    expect(acceso.model).toBe(costing.modeloPremium);
    expect(acceso.plan).toBe('esencial');
  });

  it('esencial + borrador_reporte: premium, pero CONSUME el presupuesto (tope duro sigue bloqueando)', async () => {
    const tope = (await findPlan('esencial'))!.aiMonthlyBudgetCop!;
    const userId = crearUsuario();
    suscribir(userId, 'esencial');
    gastar(userId, tope);

    const acceso = await resolveAiAccess(userId, 'borrador_reporte');
    expect(acceso.allowed).toBe(false);
    expect(acceso.blockedMessage).toBe(AI_BUDGET_BLOCKED_MESSAGE);
  });

  it('esencial: los kinds normales siguen en el modelo económico', async () => {
    const costing = await getAiCosting();
    const userId = crearUsuario();
    suscribir(userId, 'esencial');

    expect((await resolveAiAccess(userId, 'chat')).model).toBe(costing.modeloEconomico);
    expect((await resolveAiAccess(userId, 'reporte_sesion')).model).toBe(costing.modeloEconomico);
  });

  it('profesional sobre el umbral suave: borrador_reporte NO se degrada (los demás sí)', async () => {
    const costing = await getAiCosting();
    const umbral = (await findPlan('profesional'))!.aiSoftBudgetCop!;
    const userId = crearUsuario();
    suscribir(userId, 'profesional');
    gastar(userId, umbral + 1);

    expect((await resolveAiAccess(userId, 'chat')).model).toBe(costing.modeloEconomico);
    expect((await resolveAiAccess(userId, 'borrador_reporte')).model).toBe(costing.modeloPremium);
    expect((await resolveAiAccess(userId, 'sugerencias_historia')).model).toBe(costing.modeloPremium);
  });
});

describe('AiBudgetGate — admin', () => {
  it('siempre premium y sin límites, aunque el gasto sea enorme', async () => {
    const costing = await getAiCosting();
    const adminId = crearUsuario('admin');
    gastar(adminId, 10_000_000);

    const acceso = await resolveAiAccess(adminId, 'chat');
    expect(acceso.allowed).toBe(true);
    expect(acceso.model).toBe(costing.modeloPremium);
    expect(acceso.plan).toBe('admin');
  });
});
