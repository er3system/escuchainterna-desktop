/**
 * Read model de las sesiones agendadas (bookings) de un paciente para la
 * pestaña Sesiones del expediente: fecha, estado y estado de pago. El cambio
 * de estado de pago se hace SIEMPRE vía los casos de uso del contexto billing.
 */
export interface PatientBookingItem {
  bookingId: string;
  startAt: string;
  endAt: string;
  agendaName: string;
  agendaColor: string;
  modality: string;
  status: string; // agendada | confirmada | completada | cancelada | inasistencia
  price: number;
  feeCharged: number;
  feeReason: string;
  paymentStatus: 'pendiente' | 'pagada';
  paymentMethod: string | null;
  paidAt: string | null;
}

export interface PatientBookingsReader {
  listByPatient(patientId: string): Promise<PatientBookingItem[]>;
}
