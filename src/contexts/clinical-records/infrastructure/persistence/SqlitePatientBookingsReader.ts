import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  PatientBookingItem,
  PatientBookingsReader,
} from '../../domain/repositories/PatientBookingsReader';

interface BookingRow {
  id: string;
  start_at: string;
  end_at: string;
  agenda_name: string;
  agenda_color: string;
  modality: string;
  status: string;
  price: number;
  fee_charged: number;
  fee_reason: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
}

/**
 * Sesiones agendadas (bookings) del paciente para la pestaña Sesiones del
 * expediente. Solo lectura: el cambio de estado de pago pasa por billing.
 */
export class SqlitePatientBookingsReader implements PatientBookingsReader {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async listByPatient(patientId: string): Promise<PatientBookingItem[]> {
    const rows = await this.db.query<BookingRow>(
      `SELECT b.id, b.start_at, b.end_at, a.name AS agenda_name, a.color AS agenda_color,
                b.modality, b.status, b.price, b.fee_charged, b.fee_reason,
                b.payment_status, b.payment_method, b.paid_at
         FROM bookings b
         JOIN agendas a ON a.id = b.agenda_id
         WHERE b.patient_id = ? AND b.owner_user_id = ?
         ORDER BY b.start_at DESC`,
      [patientId, this.ownerUserId],
    );

    return rows.map((row) => ({
      bookingId: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
      agendaName: row.agenda_name,
      agendaColor: row.agenda_color,
      modality: row.modality,
      status: row.status,
      price: row.price,
      feeCharged: row.fee_charged,
      feeReason: row.fee_reason,
      paymentStatus: row.payment_status === 'pagada' ? 'pagada' : 'pendiente',
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
    }));
  }
}
