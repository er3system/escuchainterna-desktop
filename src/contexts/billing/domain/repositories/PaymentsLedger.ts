import type { CurrencyAmount } from '../value-objects/currencyTotals';

export interface PaymentsLedgerEntry {
  bookingId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientTags: string[];
  agendaName: string;
  agendaColor: string;
  startAt: string;
  price: number;
  /** Moneda del cobro de ESTA sesión (código ISO). */
  currency: string;
  /** Tarifa cobrada por inasistencia/cancelación tardía (0 si no aplica). */
  feeCharged: number;
  /** '' | 'inasistencia' | 'cancelacion_tardia' */
  feeReason: string;
  /** Monto efectivo por cobrar: la tarifa si aplica, si no el precio. */
  chargeAmount: number;
  bookingStatus: string; // agendada | confirmada | completada | cancelada | inasistencia
  paymentStatus: 'pendiente' | 'pagada';
  paymentMethod: string | null;
  paidAt: string | null;
  /** Folio de la última factura enviada de esta sesión (null si no hay). */
  invoiceFolio: string | null;
  invoiceSentAt: string | null;
}

export interface PaymentsLedgerCriteria {
  onlyCompleted: boolean;
  paymentStatus?: 'pendiente' | 'pagada';
  fromIso?: string;
  toIso?: string;
  tags?: string[];
  text?: string;
  /** Acota el libro a las sesiones de un paciente (pestaña Pagos del expediente). */
  patientId?: string;
}

export interface PaymentsLedgerPage {
  entries: PaymentsLedgerEntry[];
  /** Total cobrado del filtro actual, UN RENGLÓN POR MONEDA. */
  collectedByCurrency: CurrencyAmount[];
  /** Total por cobrar del filtro actual, UN RENGLÓN POR MONEDA. */
  pendingByCurrency: CurrencyAmount[];
}

/**
 * Lectura CQRS sobre bookings + patients + agendas para la pantalla de Pagos.
 */
export interface PaymentsLedger {
  search(criteria: PaymentsLedgerCriteria): Promise<PaymentsLedgerPage>;
  findByBookingId(bookingId: string): Promise<PaymentsLedgerEntry | null>;
  listKnownTags(): Promise<string[]>;
}
