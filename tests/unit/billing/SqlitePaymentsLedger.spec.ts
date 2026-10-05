import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Libro de pagos sobre BD SQLite real (bookings + patients + agendas), acotado
 * al dueño (regla de oro): total cobrado/por cobrar por moneda, tratamiento de
 * la tarifa de inasistencia/cancelación tardía y aislamiento entre profesionales.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-ledger-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqlitePaymentsLedger: typeof import('@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger')['SqlitePaymentsLedger'];

const ownerA = `owner-a-${randomUUID()}`;
const ownerB = `owner-b-${randomUUID()}`;
const agendaA = randomUUID();
const agendaB = randomUUID();
const patientA = randomUUID();
const patientB = randomUUID();

// Reservas de ownerA con las que probamos cada regla.
const bkPagadaMxn = randomUUID(); // completada + pagada en MXN
const bkPagadaCop = randomUUID(); // completada + pagada en COP
const bkPendienteMxn = randomUUID(); // completada + pendiente en MXN
const bkPendienteCop = randomUUID(); // completada + pendiente en COP
const bkCanceladaConTarifa = randomUUID(); // cancelada con fee_charged > 0 → por cobrar
const bkCanceladaSinTarifa = randomUUID(); // cancelada sin tarifa → no suma
const bkInasistencia = randomUUID(); // inasistencia: monto = fee_charged (no price)
// Reserva de ownerB (no debe verse desde ownerA).
const bkAjena = randomUUID();

let ledgerSlotHour = 8;
function insertBooking(input: {
  id: string;
  owner: string;
  agenda: string;
  patient: string;
  price: number;
  currency: string;
  status: string;
  paymentStatus: string;
  feeCharged?: number;
  feeReason?: string;
}): void {
  // Cada reserva ocupa un cupo DISTINTO: el índice único anti doble-reserva (v53) prohíbe dos
  // citas activas en el mismo (owner, agenda, start_at). Estas pruebas del ledger no dependen de
  // la hora exacta, así que basta repartirlas en horas distintas del mismo día.
  const startAt = `2026-06-01T${String(ledgerSlotHour).padStart(2, '0')}:00:00.000Z`;
  const endAt = `2026-06-01T${String(ledgerSlotHour + 1).padStart(2, '0')}:00:00.000Z`;
  ledgerSlotHour += 1;
  getDb()
    .prepare(
      `INSERT INTO bookings
         (id, agenda_id, patient_id, owner_user_id, start_at, end_at, price, currency,
          status, payment_status, fee_charged, fee_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.agenda,
      input.patient,
      input.owner,
      startAt,
      endAt,
      input.price,
      input.currency,
      input.status,
      input.paymentStatus,
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
  ({ SqlitePaymentsLedger } = await import(
    '@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  for (const [id, owner] of [
    [ownerA, ownerA],
    [ownerB, ownerB],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', 'psychologist', 'activo', ?)`,
    ).run(id, `${owner}@spec.test`, now);
  }

  for (const [id, owner] of [
    [agendaA, ownerA],
    [agendaB, ownerB],
  ] as const) {
    db.prepare(
      `INSERT INTO agendas (id, name, color, slug, owner_user_id, created_at)
       VALUES (?, 'Consulta', '#5B5BD6', ?, ?, ?)`,
    ).run(id, `slug-${id}`, owner, now);
  }

  for (const [id, owner] of [
    [patientA, ownerA],
    [patientB, ownerB],
  ] as const) {
    db.prepare(
      `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente', ?, ?)`,
    ).run(id, now, owner);
  }

  // --- Cobrado: una sesión pagada en MXN (800) y otra en COP (90000). ---
  insertBooking({ id: bkPagadaMxn, owner: ownerA, agenda: agendaA, patient: patientA, price: 800, currency: 'MXN', status: 'completada', paymentStatus: 'pagada' });
  insertBooking({ id: bkPagadaCop, owner: ownerA, agenda: agendaA, patient: patientA, price: 90000, currency: 'COP', status: 'completada', paymentStatus: 'pagada' });

  // --- Por cobrar: una pendiente en MXN (500) y otra en COP (70000). ---
  insertBooking({ id: bkPendienteMxn, owner: ownerA, agenda: agendaA, patient: patientA, price: 500, currency: 'MXN', status: 'completada', paymentStatus: 'pendiente' });
  insertBooking({ id: bkPendienteCop, owner: ownerA, agenda: agendaA, patient: patientA, price: 70000, currency: 'COP', status: 'completada', paymentStatus: 'pendiente' });

  // --- Cancelada CON tarifa (MXN 300): SÍ es por cobrar; el monto es la tarifa. ---
  insertBooking({ id: bkCanceladaConTarifa, owner: ownerA, agenda: agendaA, patient: patientA, price: 800, currency: 'MXN', status: 'cancelada', paymentStatus: 'pendiente', feeCharged: 300, feeReason: 'cancelacion_tardia' });

  // --- Cancelada SIN tarifa: NO suma a por cobrar. ---
  insertBooking({ id: bkCanceladaSinTarifa, owner: ownerA, agenda: agendaA, patient: patientA, price: 800, currency: 'MXN', status: 'cancelada', paymentStatus: 'pendiente' });

  // --- Inasistencia con tarifa (COP 50000) sobre una sesión cara (90000): el monto
  //     por cobrar debe ser la tarifa, no el precio. ---
  insertBooking({ id: bkInasistencia, owner: ownerA, agenda: agendaA, patient: patientA, price: 90000, currency: 'COP', status: 'inasistencia', paymentStatus: 'pendiente', feeCharged: 50000, feeReason: 'inasistencia' });

  // --- Sesión de OTRO dueño: no debe verse ni sumar (regla de oro). ---
  insertBooking({ id: bkAjena, owner: ownerB, agenda: agendaB, patient: patientB, price: 999999, currency: 'MXN', status: 'completada', paymentStatus: 'pagada' });
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

describe('SqlitePaymentsLedger (BD SQLite real)', () => {
  it('totaliza cobrado y por cobrar con DOS monedas en renglones separados', async () => {
    const page = await new SqlitePaymentsLedger(ownerA).search({ onlyCompleted: false });

    // Cobrado: MXN 800, COP 90000 (un renglón por moneda).
    expect(amountFor(page.collectedByCurrency, 'MXN')).toBe(800);
    expect(amountFor(page.collectedByCurrency, 'COP')).toBe(90000);

    // Por cobrar: MXN 500 (pendiente) + 300 (tarifa cancelada) = 800;
    //             COP 70000 (pendiente) + 50000 (inasistencia) = 120000.
    expect(amountFor(page.pendingByCurrency, 'MXN')).toBe(800);
    expect(amountFor(page.pendingByCurrency, 'COP')).toBe(120000);

    // Dos monedas en cada total: dos renglones, no uno mezclado.
    expect(page.collectedByCurrency).toHaveLength(2);
    expect(page.pendingByCurrency).toHaveLength(2);
  });

  it("la cancelada con tarifa suma a 'por cobrar'; la cancelada sin tarifa NO", async () => {
    const page = await new SqlitePaymentsLedger(ownerA).search({ onlyCompleted: false });
    const ids = page.entries.map((entry) => entry.bookingId);

    // La cancelada CON tarifa aparece y aporta su tarifa (verificado en el total MXN
    // de arriba: 500 + 300). La cancelada SIN tarifa aparece pero no suma por cobrar.
    expect(ids).toContain(bkCanceladaConTarifa);
    expect(ids).toContain(bkCanceladaSinTarifa);

    const conTarifa = page.entries.find((entry) => entry.bookingId === bkCanceladaConTarifa)!;
    const sinTarifa = page.entries.find((entry) => entry.bookingId === bkCanceladaSinTarifa)!;
    expect(conTarifa.feeCharged).toBe(300);
    expect(sinTarifa.feeCharged).toBe(0);

    // Si quitamos del total la cancelada con tarifa, el MXN por cobrar baja a 500
    // (solo la pendiente normal) → confirma que la sin-tarifa nunca aportó.
    expect(amountFor(page.pendingByCurrency, 'MXN')).toBe(500 + 300);
  });

  it('la inasistencia/cancelación tardía usa fee_charged como monto, no price', async () => {
    const ledger = new SqlitePaymentsLedger(ownerA);
    const inasistencia = (await ledger.findByBookingId(bkInasistencia))!;
    expect(inasistencia.price).toBe(90000);
    expect(inasistencia.feeCharged).toBe(50000);
    // chargeAmount = tarifa cuando aplica (no el precio de la sesión).
    expect(inasistencia.chargeAmount).toBe(50000);

    const cancelada = (await ledger.findByBookingId(bkCanceladaConTarifa))!;
    expect(cancelada.chargeAmount).toBe(300);
  });

  it('regla de oro: las sesiones de otro dueño no aparecen ni suman', async () => {
    const ownerALedger = new SqlitePaymentsLedger(ownerA);
    const page = await ownerALedger.search({ onlyCompleted: false });

    // La sesión ajena no está en los resultados de ownerA.
    expect(page.entries.map((entry) => entry.bookingId)).not.toContain(bkAjena);
    // Su precio (999999 MXN) no contamina el total cobrado de ownerA.
    expect(amountFor(page.collectedByCurrency, 'MXN')).toBe(800);

    // findByBookingId de una sesión de otro dueño devuelve null.
    expect(await ownerALedger.findByBookingId(bkAjena)).toBeNull();

    // ...pero el dueño legítimo SÍ la encuentra.
    expect((await new SqlitePaymentsLedger(ownerB).findByBookingId(bkAjena))?.bookingId).toBe(bkAjena);
  });
});
