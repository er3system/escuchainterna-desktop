import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import { Recurrence } from '@/contexts/scheduling/domain/Recurrence';

/**
 * SqliteBookingRepository contra una BD SQLite real y efímera. Verifica la REGLA DE ORO
 * de aislamiento por dueño (owner_user_id), el borde [start, end) de findOverlapping
 * (con exclusión de canceladas y de un id), el round-trip de save (INSERT OR REPLACE) y
 * la idempotencia de saveRecurrence.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-booking-repo-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteBookingRepository: typeof import('@/contexts/scheduling/infrastructure/persistence/SqliteBookingRepository')['SqliteBookingRepository'];

const ownerA = `owner-a-${randomUUID()}`;
const ownerB = `owner-b-${randomUUID()}`;

// Agendas/pacientes propios de cada dueño (bookings tiene FK a agendas/patients).
const agendaA = randomUUID();
const agendaB = randomUUID();
const patientA = randomUUID();
const patientB = randomUUID();

// Una sola "hora de oro" compartida por A y B para probar el aislamiento.
const goldStart = new Date('2026-07-01T15:00:00.000Z');
const goldEnd = new Date('2026-07-01T16:00:00.000Z');

let repoA: InstanceType<typeof SqliteBookingRepository>;
let repoB: InstanceType<typeof SqliteBookingRepository>;

function insertAgenda(id: string, owner: string, now: string): void {
  getDb()
    .prepare(
      `INSERT INTO agendas (id, name, slug, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, `Agenda ${id.slice(0, 8)}`, `slug-${id}`, now, owner);
}

function insertPatient(id: string, owner: string, now: string): void {
  getDb()
    .prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente', ?, ?)`)
    .run(id, now, owner);
}

/** Inserta una reserva por SQL crudo con valores por defecto razonables. */
function insertBooking(input: {
  id: string;
  owner: string;
  agendaId: string;
  patientId: string;
  start: Date;
  end: Date;
  status?: string;
  now: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO bookings
        (id, agenda_id, patient_id, start_at, end_at, price, currency, modality, meet_url,
         status, payment_status, payment_method, paid_at, recurrence_id, booked_by,
         reschedule_count, fee_charged, fee_reason, patient_note, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, 0, 'MXN', 'presencial', NULL,
               ?, 'pendiente', NULL, NULL, NULL, 'profesional',
               0, 0, '', '', ?, ?)`,
    )
    .run(
      input.id,
      input.agendaId,
      input.patientId,
      input.start.toISOString(),
      input.end.toISOString(),
      input.status ?? 'agendada',
      input.now,
      input.owner,
    );
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteBookingRepository } = await import(
    '@/contexts/scheduling/infrastructure/persistence/SqliteBookingRepository'
  ));

  const now = new Date().toISOString();
  insertAgenda(agendaA, ownerA, now);
  insertAgenda(agendaB, ownerB, now);
  insertPatient(patientA, ownerA, now);
  insertPatient(patientB, ownerB, now);

  repoA = new SqliteBookingRepository(ownerA);
  repoB = new SqliteBookingRepository(ownerB);
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

describe('SqliteBookingRepository (aislamiento por dueño y bordes de traslape)', () => {
  it('[regla de oro] no devuelve ni colisiona con reservas de OTRO owner_user_id', async () => {
    const now = new Date().toISOString();
    const bookingA = randomUUID();
    const bookingB = randomUUID();

    // A y B tienen una reserva en EXACTAMENTE la misma hora.
    insertBooking({ id: bookingA, owner: ownerA, agendaId: agendaA, patientId: patientA, start: goldStart, end: goldEnd, now });
    insertBooking({ id: bookingB, owner: ownerB, agendaId: agendaB, patientId: patientB, start: goldStart, end: goldEnd, now });

    // findById está acotado al dueño: A no ve la reserva de B y viceversa.
    expect((await repoA.findById(bookingA))?.bookingId()).toBe(bookingA);
    expect(await repoA.findById(bookingB)).toBeNull();
    expect((await repoB.findById(bookingB))?.bookingId()).toBe(bookingB);
    expect(await repoB.findById(bookingA)).toBeNull();

    // findOverlapping a la misma hora: cada dueño ve SOLO la suya (no colisiona con la del otro).
    const overlapA = await repoA.findOverlapping(goldStart, goldEnd);
    expect(overlapA.map((b) => b.bookingId())).toEqual([bookingA]);
    const overlapB = await repoB.findOverlapping(goldStart, goldEnd);
    expect(overlapB.map((b) => b.bookingId())).toEqual([bookingB]);

    // findActiveBetween en una ventana que cubre la hora: cada dueño ve SOLO la suya.
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-07-02T00:00:00.000Z');
    expect((await repoA.findActiveBetween(from, to)).map((b) => b.bookingId())).toEqual([bookingA]);
    expect((await repoB.findActiveBetween(from, to)).map((b) => b.bookingId())).toEqual([bookingB]);
  });

  it('findOverlapping excluye canceladas, respeta excludeBookingId y trata [start,end) como medio abierto', async () => {
    const now = new Date().toISOString();
    const owner = `owner-overlap-${randomUUID()}`;
    // Agenda/paciente nuevos para esta ventana de tiempo aislada.
    const ag = randomUUID();
    const pa = randomUUID();
    insertAgenda(ag, owner, now);
    insertPatient(pa, owner, now);
    const repo = new SqliteBookingRepository(owner);

    const win9 = new Date('2026-08-10T09:00:00.000Z');
    const win10 = new Date('2026-08-10T10:00:00.000Z');
    const win11 = new Date('2026-08-10T11:00:00.000Z');

    const activo = randomUUID();
    const cancelado = randomUUID();
    const contigua = randomUUID();

    // Sesión activa 9–10.
    insertBooking({ id: activo, owner, agendaId: ag, patientId: pa, start: win9, end: win10, now });
    // Sesión CANCELADA 9–10 (no debe contar como traslape).
    insertBooking({ id: cancelado, owner, agendaId: ag, patientId: pa, start: win9, end: win10, status: 'cancelada', now });
    // Sesión 10–11: empieza justo cuando termina la de 9–10 (borde, NO solapa con 9–10).
    insertBooking({ id: contigua, owner, agendaId: ag, patientId: pa, start: win10, end: win11, now });

    // Consultar el rango 9–10: solo aparece la activa (la cancelada se excluye).
    const at9to10 = await repo.findOverlapping(win9, win10);
    expect(at9to10.map((b) => b.bookingId())).toEqual([activo]);

    // Borde medio abierto: una sesión que termina a las 10 NO solapa con otra que empieza a las 10.
    const at10to11 = await repo.findOverlapping(win10, win11);
    expect(at10to11.map((b) => b.bookingId())).toEqual([contigua]);

    // excludeBookingId: al excluir la propia sesión activa, el rango 9–10 queda libre.
    const excludingSelf = await repo.findOverlapping(win9, win10, activo);
    expect(excludingSelf).toEqual([]);
  });

  it('save (INSERT OR REPLACE) conserva owner_user_id y hace round-trip de los campos clave', async () => {
    const recurrenceId = randomUUID();
    // La reserva referencia una recurrencia: debe existir por la FK recurrence_id.
    await repoA.saveRecurrence(Recurrence.create(recurrenceId, 'semanal', 4));

    const bookingId = randomUUID();
    const start = new Date('2026-09-01T12:00:00.000Z');
    const end = new Date('2026-09-01T13:00:00.000Z');
    const booking = Booking.fromPrimitives({
      id: bookingId,
      agendaId: agendaA,
      patientId: patientA,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      price: 350,
      currency: 'COP',
      modality: 'virtual',
      meetUrl: 'https://meet.example/abc',
      status: 'inasistencia',
      paymentStatus: 'pendiente',
      paymentMethod: null,
      paidAt: null,
      recurrenceId,
      bookedBy: 'profesional',
      rescheduleCount: 2,
      feeCharged: 90000,
      feeReason: 'inasistencia',
      patientNote: 'Me siento ansioso por el trabajo',
      createdAt: new Date('2026-08-20T08:00:00.000Z').toISOString(),
    });

    await repoA.save(booking);

    // El dueño la encuentra; el otro dueño NO (owner_user_id se conservó como ownerA).
    expect(await repoB.findById(bookingId)).toBeNull();
    const loaded = await repoA.findById(bookingId);
    expect(loaded).not.toBeNull();

    const p = loaded!.toPrimitives();
    expect(p.currency).toBe('COP');
    expect(p.feeCharged).toBe(90000);
    expect(p.feeReason).toBe('inasistencia');
    expect(p.patientNote).toBe('Me siento ansioso por el trabajo');
    expect(p.recurrenceId).toBe(recurrenceId);
    expect(p.modality).toBe('virtual');
    expect(p.meetUrl).toBe('https://meet.example/abc');
    expect(p.rescheduleCount).toBe(2);

    // Confirmamos directamente en la columna que el dueño quedó correcto.
    const ownerRow = getDb()
      .prepare('SELECT owner_user_id AS owner FROM bookings WHERE id = ?')
      .get(bookingId) as { owner: string };
    expect(ownerRow.owner).toBe(ownerA);

    // INSERT OR REPLACE: re-guardar con el mismo id actualiza sin duplicar.
    booking.markAsPaid('transferencia', new Date('2026-09-01T13:30:00.000Z'));
    await repoA.save(booking);
    const count = getDb()
      .prepare('SELECT COUNT(*) AS n FROM bookings WHERE id = ?')
      .get(bookingId) as { n: number };
    expect(count.n).toBe(1);
    const reloaded = (await repoA.findById(bookingId))!.toPrimitives();
    expect(reloaded.paymentStatus).toBe('pagada');
    expect(reloaded.paymentMethod).toBe('transferencia');
  });

  it('saveRecurrence inserta en recurrences y re-insertar el mismo id no revienta (OR REPLACE)', async () => {
    const recurrenceId = randomUUID();
    const first = Recurrence.create(recurrenceId, 'semanal', 4);

    await expect(repoA.saveRecurrence(first)).resolves.toBeUndefined();
    const after1 = getDb()
      .prepare('SELECT frequency, repeat_count AS repeatCount FROM recurrences WHERE id = ?')
      .get(recurrenceId) as { frequency: string; repeatCount: number };
    expect(after1.frequency).toBe('semanal');
    expect(after1.repeatCount).toBe(4);

    // Mismo id, datos distintos: INSERT OR REPLACE no debe lanzar y debe reemplazar.
    const second = Recurrence.create(recurrenceId, 'quincenal', 6);
    await expect(repoA.saveRecurrence(second)).resolves.toBeUndefined();

    const count = getDb()
      .prepare('SELECT COUNT(*) AS n FROM recurrences WHERE id = ?')
      .get(recurrenceId) as { n: number };
    expect(count.n).toBe(1);
    const after2 = getDb()
      .prepare('SELECT frequency, repeat_count AS repeatCount FROM recurrences WHERE id = ?')
      .get(recurrenceId) as { frequency: string; repeatCount: number };
    expect(after2.frequency).toBe('quincenal');
    expect(after2.repeatCount).toBe(6);
  });
});
