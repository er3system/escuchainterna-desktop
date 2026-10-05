import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Métricas del dashboard sobre BD SQLite real (bookings + patients + agendas).
 * Regresión: el dashboard debe CUADRAR con el ledger (/pagos). El reader ahora usa
 * CASE WHEN fee_charged > 0 THEN fee_charged ELSE price END (mismo "monto cobrable"
 * del ledger) y, para "por cobrar", incluye canceladas con tarifa. Antes sumaba
 * SUM(price), que inflaba ingresos y por-cobrar frente a /pagos.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-dashboard-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteDashboardMetricsReader: typeof import('@/contexts/billing/infrastructure/persistence/SqliteDashboardMetricsReader')['SqliteDashboardMetricsReader'];

const owner = `owner-dash-${randomUUID()}`;
const agenda = randomUUID();
const patient = randomUUID();

// Mes de referencia: junio 2026. Todo cae dentro del mes.
const reference = new Date('2026-06-15T12:00:00.000Z');
const paidAt = '2026-06-10T18:30:00.000Z';
// Cada reserva en un cupo DISTINTO dentro de junio: el índice único anti doble-reserva (v53)
// prohíbe dos citas activas en el mismo (owner, agenda, start_at). Las métricas filtran por mes,
// así que se quedan dentro de junio 2026 (la hora exacta no mueve los totales).
let dashSlotHour = 8;

// Reservas con las que probamos cada regla de regresión.
const bkNoShowPagada = randomUUID(); // inasistencia pagada: cobrado = fee (300), no price (1000)
const bkCanceladaPendiente = randomUUID(); // cancelada con tarifa pendiente: SÍ por cobrar (300)
const bkNoShowPendiente = randomUUID(); // inasistencia pendiente: por cobrar = fee (300), no price (1000)
const bkCop = randomUUID(); // pagada en otra moneda: renglón separado

function insertBooking(input: {
  id: string;
  price: number;
  currency: string;
  status: string;
  paymentStatus: string;
  feeCharged?: number;
  feeReason?: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
}): void {
  const startAt = `2026-06-10T${String(dashSlotHour).padStart(2, '0')}:00:00.000Z`;
  const endAt = `2026-06-10T${String(dashSlotHour + 1).padStart(2, '0')}:00:00.000Z`;
  dashSlotHour += 1;
  getDb()
    .prepare(
      `INSERT INTO bookings
         (id, agenda_id, patient_id, owner_user_id, start_at, end_at, price, currency,
          status, payment_status, payment_method, paid_at, fee_charged, fee_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      agenda,
      patient,
      owner,
      startAt,
      endAt,
      input.price,
      input.currency,
      input.status,
      input.paymentStatus,
      input.paymentMethod ?? null,
      input.paidAt ?? null,
      input.feeCharged ?? 0,
      input.feeReason ?? '',
      '2026-06-01T00:00:00.000Z',
    );
}

function amountFor(rows: Array<{ currency: string; amount: number }>, currency: string): number {
  return rows.find((row) => row.currency === currency)?.amount ?? 0;
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteDashboardMetricsReader } = await import(
    '@/contexts/billing/infrastructure/persistence/SqliteDashboardMetricsReader'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at)
     VALUES (?, ?, 'hash', 'psychologist', 'activo', ?)`,
  ).run(owner, `${owner}@spec.test`, now);

  db.prepare(
    `INSERT INTO agendas (id, name, color, slug, owner_user_id, created_at)
     VALUES (?, 'Consulta', '#5B5BD6', ?, ?, ?)`,
  ).run(agenda, `slug-${agenda}`, owner, now);

  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente', ?, ?)`,
  ).run(patient, now, owner);

  // --- Inasistencia PAGADA en MXN: price=1000, fee=300, pagada con efectivo dentro del mes.
  //     El cobrado del mes debe ser 300 (la tarifa), NO 1000 (el precio). ---
  insertBooking({
    id: bkNoShowPagada,
    price: 1000,
    currency: 'MXN',
    status: 'inasistencia',
    paymentStatus: 'pagada',
    feeCharged: 300,
    feeReason: 'inasistencia',
    paymentMethod: 'efectivo',
    paidAt,
  });

  // --- Cancelada CON tarifa, pendiente: antes se excluía del por-cobrar; ahora suma 300. ---
  insertBooking({
    id: bkCanceladaPendiente,
    price: 800,
    currency: 'MXN',
    status: 'cancelada',
    paymentStatus: 'pendiente',
    feeCharged: 300,
    feeReason: 'cancelacion_tardia',
  });

  // --- Inasistencia PENDIENTE: price=1000, fee=300. Por cobrar = 300 (la tarifa), no 1000. ---
  insertBooking({
    id: bkNoShowPendiente,
    price: 1000,
    currency: 'MXN',
    status: 'inasistencia',
    paymentStatus: 'pendiente',
    feeCharged: 300,
    feeReason: 'inasistencia',
  });

  // --- Sesión pagada normal en COP: renglón de moneda separado (cobrado y método). ---
  insertBooking({
    id: bkCop,
    price: 90000,
    currency: 'COP',
    status: 'completada',
    paymentStatus: 'pagada',
    paymentMethod: 'transferencia',
    paidAt,
  });
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

describe('SqliteDashboardMetricsReader (BD SQLite real)', () => {
  it("'Cobrado del mes' suma el monto cobrable (fee), no el price", async () => {
    const snapshot = await new SqliteDashboardMetricsReader(owner).snapshotAt(reference);
    // La inasistencia pagada aporta su tarifa (300), no el precio de la sesión (1000).
    expect(amountFor(snapshot.collectedThisMonth, 'MXN')).toBe(300);
    // La sesión COP pagada aporta su precio completo (sin tarifa).
    expect(amountFor(snapshot.collectedThisMonth, 'COP')).toBe(90000);
  });

  it("'Por cobrar del mes' incluye la cancelada CON tarifa (antes la excluía)", async () => {
    const snapshot = await new SqliteDashboardMetricsReader(owner).snapshotAt(reference);
    // MXN por cobrar = 300 (cancelada con tarifa) + 300 (inasistencia pendiente) = 600.
    // Si la cancelada se excluyera (regresión), el total sería 300.
    expect(amountFor(snapshot.pendingThisMonth, 'MXN')).toBe(600);
  });

  it("'Por cobrar' de una inasistencia pendiente usa el fee, no el price", async () => {
    const snapshot = await new SqliteDashboardMetricsReader(owner).snapshotAt(reference);
    // Si usara price, la inasistencia pendiente sola aportaría 1000 y el total MXN
    // sería 1300; como usa el fee (300), aporta 300 → total 600.
    expect(amountFor(snapshot.pendingThisMonth, 'MXN')).toBe(300 + 300);
    expect(amountFor(snapshot.pendingTotal, 'MXN')).toBe(300 + 300);
  });

  it('incomeByMethod e history usan el monto cobrable (fee), no el price', async () => {
    const snapshot = await new SqliteDashboardMetricsReader(owner).snapshotAt(reference);

    // La inasistencia pagada en efectivo aporta su fee (300), no el price (1000).
    const efectivoMxn = snapshot.incomeByMethod.find(
      (row) => row.method === 'efectivo' && row.currency === 'MXN',
    );
    expect(efectivoMxn?.amount).toBe(300);

    const transferenciaCop = snapshot.incomeByMethod.find(
      (row) => row.method === 'transferencia' && row.currency === 'COP',
    );
    expect(transferenciaCop?.amount).toBe(90000);

    // El histórico del mes en curso (último punto) cuadra con el cobrado, ahora
    // DESGLOSADO por moneda (ya no un SUM que mezclaba MXN + COP en un solo número).
    const lastPoint = snapshot.history[snapshot.history.length - 1];
    expect(lastPoint.month).toBe('2026-06');
    expect(lastPoint.incomeByCurrency.MXN).toBe(300);
    expect(lastPoint.incomeByCurrency.COP).toBe(90000);
  });

  it('multi-moneda: dos monedas quedan en renglones separados', async () => {
    const snapshot = await new SqliteDashboardMetricsReader(owner).snapshotAt(reference);
    // Cobrado del mes: un renglón MXN (300) y un renglón COP (90000).
    expect(snapshot.collectedThisMonth).toHaveLength(2);
    const currencies = snapshot.collectedThisMonth.map((row) => row.currency).sort();
    expect(currencies).toEqual(['COP', 'MXN']);
  });
});
