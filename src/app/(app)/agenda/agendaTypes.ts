import type { CalendarBookingItem } from '@/contexts/scheduling/application/calendar-bookings/CalendarBookings';
import type { BookingDetail } from '@/contexts/scheduling/application/get-booking-detail/GetBookingDetail';
import { formatMoneyWithCode } from '@/shared/domain/currencies';

/** Vistas del calendario de la agenda. */
export type AgendaView = 'mes' | 'semana' | 'tabla' | 'dia';

export function parseAgendaView(value: string | undefined): AgendaView {
  if (value === 'semana' || value === 'tabla' || value === 'dia') return value;
  return 'mes';
}

/** Opción de agenda (tipo de sesión) con sus valores efectivos para la UI. */
export interface AgendaOption {
  id: string;
  name: string;
  color: string;
  slug: string;
  durationMinutes: number;
  /** Precio efectivo (override o global). */
  price: number;
  /** Moneda efectiva (override de la agenda o la del perfil). */
  currency: string;
  /** Modalidad efectiva (override o global). */
  modality: 'presencial' | 'virtual' | 'ambas';
  active: boolean;
}

/** Paciente mínimo para el selector de la reservación. */
export interface PatientOption {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

/** Espacio bloqueado (no reservable, no es un paciente) para pintar en el calendario. */
export interface CalendarBlockItem {
  id: string;
  /** Inicio (ISO 8601). */
  startAt: string;
  /** Fin (ISO 8601). */
  endAt: string;
  /** Motivo libre (ej. "Almuerzo"); puede ir vacío. */
  title: string;
}

/** Mensaje del outbox ligado a una reservación (modal «Ver mensajes»). */
export interface BookingMessage {
  id: string;
  channel: 'whatsapp' | 'email';
  template: string;
  templateLabel: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

export type { CalendarBookingItem, BookingDetail };

/** Monto con formato local y código ISO visible para divisas con símbolos compartidos. */
export function formatMoney(amount: number, currency = 'MXN'): string {
  return formatMoneyWithCode(amount, currency);
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  inasistencia: 'Inasistencia',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Sin pagar',
  pagada: 'Pagado',
};
