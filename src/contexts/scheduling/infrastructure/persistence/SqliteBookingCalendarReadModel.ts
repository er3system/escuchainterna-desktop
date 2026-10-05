import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  BookingModality,
  BookingPaymentStatus,
  BookingStatus,
} from '../../domain/Booking';
import type {
  BookingCalendarReadModel,
  CalendarBookingRow,
} from '../../domain/repositories/BookingCalendarReadModel';

interface CalendarRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string;
  modality: string;
  price: number;
  currency: string;
  patient_id: string;
  patient_name: string;
  agenda_id: string;
  agenda_name: string;
  agenda_color: string;
  consultorio_id: string | null;
  consultorio_name: string | null;
  last_whatsapp_status: string | null;
}

/** Read model del calendario acotado al dueño (owner_user_id) de la sesión. */
export class SqliteBookingCalendarReadModel implements BookingCalendarReadModel {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findBetween(from: Date, to: Date): Promise<CalendarBookingRow[]> {
    const rows = await this.db.query<CalendarRow>(
      `SELECT b.id, b.start_at, b.end_at, b.status, b.payment_status, b.modality, b.price,
                b.currency,
                b.patient_id, p.full_name AS patient_name,
                b.agenda_id, a.name AS agenda_name, a.color AS agenda_color,
                b.consultorio_id, c.name AS consultorio_name,
                (SELECT o.status FROM outbox_messages o
                  WHERE o.booking_id = b.id AND o.channel = 'whatsapp'
                  ORDER BY o.created_at DESC LIMIT 1) AS last_whatsapp_status
         FROM bookings b
         JOIN patients p ON p.id = b.patient_id
         JOIN agendas a ON a.id = b.agenda_id
         LEFT JOIN consultorios c ON c.id = b.consultorio_id AND c.archived = 0
         WHERE b.owner_user_id = ? AND b.start_at < ? AND b.end_at > ?
         ORDER BY b.start_at ASC`,
      [this.ownerUserId, to.toISOString(), from.toISOString()],
    );
    return rows.map((row) => ({
      id: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status as BookingStatus,
      paymentStatus: row.payment_status as BookingPaymentStatus,
      modality: row.modality as BookingModality,
      price: row.price,
      currency: row.currency || 'MXN',
      patientId: row.patient_id,
      patientName: row.patient_name,
      agendaId: row.agenda_id,
      agendaName: row.agenda_name,
      agendaColor: row.agenda_color,
      consultorioId: row.consultorio_id,
      consultorioName: row.consultorio_name,
      lastWhatsappStatus: row.last_whatsapp_status,
    }));
  }
}
