import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Repositorio de facturas sobre BD SQLite real: la secuencia de folio es por
 * dueño y por año (nextSequenceForYear) y el (owner_user_id, folio) es único
 * en la BD (índice idx_invoices_owner_folio de la migración v36).
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-invoices-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteInvoiceRepository: typeof import('@/contexts/billing/infrastructure/persistence/SqliteInvoiceRepository')['SqliteInvoiceRepository'];
let Invoice: typeof import('@/contexts/billing/domain/Invoice')['Invoice'];
let InvoiceFolio: typeof import('@/contexts/billing/domain/value-objects/InvoiceFolio')['InvoiceFolio'];

const ownerA = `owner-a-${randomUUID()}`;
const ownerB = `owner-b-${randomUUID()}`;
const patientA = randomUUID();
const patientB = randomUUID();
const agendaA = randomUUID();
const agendaB = randomUUID();

// Reservas reales (invoices.booking_id tiene FK a bookings(id)).
const bookingA1 = randomUUID();
const bookingA2 = randomUUID();
const bookingB1 = randomUUID();

async function insertInvoice(input: {
  owner: string;
  patient: string;
  booking: string;
  folio: string;
}): Promise<void> {
  await new SqliteInvoiceRepository(input.owner).save(
    Invoice.issue({
      id: randomUUID(),
      bookingId: input.booking,
      patientId: input.patient,
      folio: InvoiceFolio.fromString(input.folio),
      amount: 800,
      currency: 'MXN',
      outboxMessageId: null,
      sentAt: new Date('2026-06-01T10:00:00.000Z'),
    }),
  );
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteInvoiceRepository } = await import(
    '@/contexts/billing/infrastructure/persistence/SqliteInvoiceRepository'
  ));
  ({ Invoice } = await import('@/contexts/billing/domain/Invoice'));
  ({ InvoiceFolio } = await import('@/contexts/billing/domain/value-objects/InvoiceFolio'));

  const db = getDb();
  const now = new Date().toISOString();

  for (const [id] of [[ownerA], [ownerB]] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', 'psychologist', 'activo', ?)`,
    ).run(id, `${id}@spec.test`, now);
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
  let invoiceSlot = 0;
  for (const [id, agenda, patient, owner] of [
    [bookingA1, agendaA, patientA, ownerA],
    [bookingA2, agendaA, patientA, ownerA],
    [bookingB1, agendaB, patientB, ownerB],
  ] as const) {
    // start_at distinto por reserva: el índice único anti doble-reserva (v53) prohíbe dos citas
    // activas en el mismo (owner, agenda, start_at) — bookingA1/A2 son del mismo dueño y agenda.
    // Estas pruebas de folio no usan la hora de la cita.
    const startAt = new Date(Date.parse(now) + invoiceSlot * 3_600_000).toISOString();
    invoiceSlot += 1;
    db.prepare(
      `INSERT INTO bookings
         (id, agenda_id, patient_id, owner_user_id, start_at, end_at, price, currency,
          status, payment_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 800, 'MXN', 'completada', 'pagada', ?)`,
    ).run(id, agenda, patient, owner, startAt, startAt, now);
  }
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

describe('SqliteInvoiceRepository.nextSequenceForYear (BD SQLite real)', () => {
  it('arranca en 1 sin facturas y continúa tras las existentes del mismo dueño', async () => {
    const repo = new SqliteInvoiceRepository(ownerA);

    // Sin facturas: la secuencia arranca en 1.
    expect(await repo.nextSequenceForYear(2026)).toBe(1);

    // Guardamos EI-2026-0001 → la siguiente es 2.
    await insertInvoice({ owner: ownerA, patient: patientA, booking: bookingA1, folio: 'EI-2026-0001' });
    expect(await repo.nextSequenceForYear(2026)).toBe(2);

    // Guardamos EI-2026-0007 (salto): la secuencia continúa tras el MAX, no tras el conteo.
    await insertInvoice({ owner: ownerA, patient: patientA, booking: bookingA2, folio: 'EI-2026-0007' });
    expect(await repo.nextSequenceForYear(2026)).toBe(8);
  });

  it('la secuencia es POR dueño y POR año', async () => {
    // ownerA ya tiene folios de 2026; ownerB no corre su consecutivo.
    expect(await new SqliteInvoiceRepository(ownerB).nextSequenceForYear(2026)).toBe(1);

    // Y los folios de 2025 de ownerA no afectan el primero de 2026 (distinto año).
    await insertInvoice({ owner: ownerA, patient: patientA, booking: bookingA1, folio: 'EI-2025-0042' });
    expect(await new SqliteInvoiceRepository(ownerA).nextSequenceForYear(2025)).toBe(43);
    // 2026 sigue en 8 (los folios de 2025 no lo movieron).
    expect(await new SqliteInvoiceRepository(ownerA).nextSequenceForYear(2026)).toBe(8);
  });
});

describe('SqliteInvoiceRepository unicidad de folio (índice v36)', () => {
  it('rechaza guardar dos facturas con el MISMO (dueño, folio)', async () => {
    // (repo no se usa: el INSERT lo hace insertInvoice; la unicidad la impone la BD.)
    const folio = 'EI-2026-0500';

    // Primera emisión: OK.
    await expect(
      insertInvoice({ owner: ownerA, patient: patientA, booking: bookingA1, folio }),
    ).resolves.not.toThrow();

    // Segunda emisión del MISMO folio para el MISMO dueño: la BD lo rechaza
    // (UNIQUE idx_invoices_owner_folio), aunque sea otra factura/booking.
    await expect(
      insertInvoice({ owner: ownerA, patient: patientA, booking: bookingA2, folio }),
    ).rejects.toThrow();

    // El MISMO folio para OTRO dueño sí se permite (la unicidad es por dueño).
    await expect(
      insertInvoice({ owner: ownerB, patient: patientB, booking: bookingB1, folio }),
    ).resolves.not.toThrow();
  });
});
