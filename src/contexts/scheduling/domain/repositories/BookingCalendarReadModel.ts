import type { BookingModality, BookingPaymentStatus, BookingStatus } from '../Booking';

/** Fila del read model del calendario: reserva + paciente + agenda + último WhatsApp. */
export interface CalendarBookingRow {
  id: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  modality: BookingModality;
  price: number;
  /** Moneda del cobro de la reserva (puede diferir de la del perfil). */
  currency: string;
  patientId: string;
  patientName: string;
  agendaId: string;
  agendaName: string;
  agendaColor: string;
  /** Sede de la sesión (Modo Sedes): id y nombre del consultorio, o null si no aplica. */
  consultorioId: string | null;
  consultorioName: string | null;
  /** Status del último mensaje de WhatsApp del outbox ligado a la reserva (o null). */
  lastWhatsappStatus: string | null;
}

export interface BookingCalendarReadModel {
  findBetween(from: Date, to: Date): Promise<CalendarBookingRow[]>;
}
