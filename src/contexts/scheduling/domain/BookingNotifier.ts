import type { BookingModality } from './Booking';
import type { PatientContact } from './PatientDirectory';

/** Datos ya resueltos (booking + paciente + ubicación/pago efectivos) para notificar. */
export interface SessionNotificationData {
  bookingId: string;
  patient: PatientContact;
  practitionerName: string;
  startAt: string; // ISO
  durationMinutes: number;
  modality: BookingModality;
  address: string;
  mapsUrl: string;
  meetUrl: string | null;
  price: number;
  currency: string;
  showPrice: boolean;
  showPaymentLink: boolean;
  paymentPolicies: string;
}

/** Puerto de notificaciones de sesiones (WhatsApp/correo vía outbox local). */
export interface BookingNotifier {
  sessionBooked(data: SessionNotificationData): Promise<void>;
  sessionRescheduled(data: SessionNotificationData): Promise<void>;
  sessionCancelled(data: SessionNotificationData): Promise<void>;
  sessionReminder(data: SessionNotificationData): Promise<void>;
}
