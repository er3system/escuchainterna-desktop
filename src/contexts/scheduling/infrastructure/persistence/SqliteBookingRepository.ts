import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Booking } from '../../domain/Booking';
import type {
  BookingActor,
  BookingFeeReason,
  BookingModality,
  BookingPaymentMethod,
  BookingPaymentStatus,
  BookingPrimitives,
  BookingStatus,
} from '../../domain/Booking';
import { Recurrence } from '../../domain/Recurrence';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';

interface BookingRow {
  id: string;
  agenda_id: string;
  patient_id: string;
  start_at: string;
  end_at: string;
  price: number;
  currency: string;
  modality: string;
  meet_url: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  recurrence_id: string | null;
  booked_by: string;
  reschedule_count: number;
  fee_charged: number;
  fee_reason: string;
  /** Nota del paciente al agendar (migración v11). */
  patient_note: string;
  created_at: string;
}

/** Repositorio de reservas acotado al dueño (owner_user_id) de la sesión. */
export class SqliteBookingRepository implements BookingRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(booking: Booking): Promise<void> {
    const primitives = booking.toPrimitives();
    // Upsert keyed SOLO en la PK (id), NO INSERT OR REPLACE. Con el índice único anti
    // doble-reserva (idx_bookings_no_double), un REPLACE de una cita con id NUEVO que colisione
    // en (owner, agenda, start_at) BORRARÍA en silencio la cita existente; con ON CONFLICT(id)
    // esa colisión es una violación de constraint que LANZA (la promesa de execute RECHAZA →
    // el await propaga el error → la transacción del caso de uso hace rollback y la cita
    // ocupada se conserva). Re-guardar la MISMA cita (pago/reagenda, mismo id) entra por
    // DO UPDATE sin violar el índice (se compara consigo misma).
    await this.db.execute(
      `INSERT INTO bookings
          (id, agenda_id, patient_id, start_at, end_at, price, currency, modality, meet_url,
           status, payment_status, payment_method, paid_at, recurrence_id, booked_by,
           reschedule_count, fee_charged, fee_reason, patient_note, created_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           agenda_id = excluded.agenda_id,
           patient_id = excluded.patient_id,
           start_at = excluded.start_at,
           end_at = excluded.end_at,
           price = excluded.price,
           currency = excluded.currency,
           modality = excluded.modality,
           meet_url = excluded.meet_url,
           status = excluded.status,
           payment_status = excluded.payment_status,
           payment_method = excluded.payment_method,
           paid_at = excluded.paid_at,
           recurrence_id = excluded.recurrence_id,
           booked_by = excluded.booked_by,
           reschedule_count = excluded.reschedule_count,
           fee_charged = excluded.fee_charged,
           fee_reason = excluded.fee_reason,
           patient_note = excluded.patient_note,
           owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.agendaId,
        primitives.patientId,
        primitives.startAt,
        primitives.endAt,
        primitives.price,
        primitives.currency,
        primitives.modality,
        primitives.meetUrl,
        primitives.status,
        primitives.paymentStatus,
        primitives.paymentMethod,
        primitives.paidAt,
        primitives.recurrenceId,
        primitives.bookedBy,
        primitives.rescheduleCount,
        primitives.feeCharged,
        primitives.feeReason,
        primitives.patientNote,
        primitives.createdAt,
        this.ownerUserId,
      ],
    );
  }

  public async saveRecurrence(recurrence: Recurrence): Promise<void> {
    const primitives = recurrence.toPrimitives();
    await this.db.execute(
      `INSERT INTO recurrences (id, frequency, repeat_count, until_date)
         VALUES (?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           frequency = excluded.frequency,
           repeat_count = excluded.repeat_count,
           until_date = excluded.until_date`,
      [primitives.id, primitives.frequency, primitives.repeatCount],
    );
  }

  public async findById(id: string): Promise<Booking | null> {
    const row = await this.db.queryRow<BookingRow>(
      'SELECT * FROM bookings WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? Booking.fromPrimitives(this.hydrate(row)) : null;
  }

  public async findOverlapping(
    start: Date,
    end: Date,
    excludeBookingId?: string,
  ): Promise<Booking[]> {
    const params: Array<string> = [this.ownerUserId, end.toISOString(), start.toISOString()];
    let sql = `SELECT * FROM bookings
       WHERE owner_user_id = ? AND status != 'cancelada' AND start_at < ? AND end_at > ?`;
    if (excludeBookingId) {
      sql += ' AND id != ?';
      params.push(excludeBookingId);
    }
    sql += ' ORDER BY start_at ASC';
    const rows = await this.db.query<BookingRow>(sql, params);
    return rows.map((row) => Booking.fromPrimitives(this.hydrate(row)));
  }

  public async findActiveBetween(from: Date, to: Date): Promise<Booking[]> {
    const rows = await this.db.query<BookingRow>(
      `SELECT * FROM bookings
         WHERE owner_user_id = ? AND status != 'cancelada' AND start_at < ? AND end_at > ?
         ORDER BY start_at ASC`,
      [this.ownerUserId, to.toISOString(), from.toISOString()],
    );
    return rows.map((row) => Booking.fromPrimitives(this.hydrate(row)));
  }

  private hydrate(row: BookingRow): BookingPrimitives {
    return {
      id: row.id,
      agendaId: row.agenda_id,
      patientId: row.patient_id,
      startAt: row.start_at,
      endAt: row.end_at,
      price: row.price,
      currency: row.currency || 'MXN',
      modality: row.modality as BookingModality,
      meetUrl: row.meet_url,
      status: row.status as BookingStatus,
      paymentStatus: row.payment_status as BookingPaymentStatus,
      paymentMethod: row.payment_method as BookingPaymentMethod | null,
      paidAt: row.paid_at,
      recurrenceId: row.recurrence_id,
      bookedBy: row.booked_by as BookingActor,
      rescheduleCount: row.reschedule_count,
      feeCharged: row.fee_charged ?? 0,
      feeReason: (row.fee_reason ?? '') as BookingFeeReason,
      patientNote: row.patient_note ?? '',
      createdAt: row.created_at,
    };
  }
}
