import { differenceInMinutes } from 'date-fns';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Lectura mínima de una sesión para su página pública de pago
 * (/sesion/[bookingId], accesible por id UUID no adivinable, sin login).
 *
 * Seguridad: SOLO datos no clínicos — nombre del profesional, fecha/hora,
 * monto, estado de pago y el primer nombre del paciente. ownerUserId no se
 * pasa nunca al cliente; se usa en el servidor para MarkBookingPaid.
 *
 * Nota de arquitectura: read model puro de la ruta pública (mismo patrón que
 * supervisionData.ts e integrationConnections.ts); las filas sqlite se
 * convierten aquí a objetos planos.
 */
/**
 * Datos de ubicación y contacto del profesional dueño de la reserva, expuestos
 * a la página pública para la tarjeta "Cómo llegar / contacto". SOLO datos de
 * contacto/ubicación del profesional (nada clínico ni de sesión): dirección,
 * mapa, enlace de videollamada, WhatsApp (lada+celular ya saneado) y correo.
 * Cualquier campo vacío se normaliza a null para que la UI no muestre tarjetas
 * con datos a medias.
 */
export interface PublicPractitionerContact {
  /** Dirección del consultorio (presencial). */
  address: string | null;
  /** URL de Google Maps de la dirección. */
  mapsUrl: string | null;
  /** Enlace de la videollamada de ESTA reserva (meet_url). */
  meetUrl: string | null;
  /** Número listo para wa.me: solo dígitos de lada+celular (sin «+» ni espacios). */
  whatsapp: string | null;
  /** Correo del profesional (users.email del dueño). */
  email: string | null;
}

export interface PublicSessionView {
  bookingId: string;
  /** Solo para uso en el servidor (scoping de MarkBookingPaid). */
  ownerUserId: string;
  /** Solo para uso en el servidor (FindAvailableSlots al reagendar). */
  agendaId: string;
  practitionerName: string;
  agendaName: string;
  patientFirstName: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  modality: string;
  price: number;
  currency: string;
  status: string;
  paymentStatus: 'pendiente' | 'pagada';
  paymentMethod: string | null;
  paidAt: string | null;
  /** Ubicación/contacto del profesional para la tarjeta "Cómo llegar". */
  contact: PublicPractitionerContact;
}

interface SessionRow {
  id: string;
  owner_user_id: string | null;
  agenda_id: string;
  start_at: string;
  end_at: string;
  price: number;
  modality: string;
  meet_url: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  agenda_name: string | null;
  patient_name: string | null;
  practitioner_name: string | null;
  currency: string | null;
  practitioner_address: string | null;
  practitioner_maps_url: string | null;
  practitioner_phone: string | null;
  practitioner_phone_code: string | null;
  practitioner_email: string | null;
}

/** Deja solo los dígitos de lada+celular para construir el enlace wa.me. */
function toWhatsappDigits(dialCode: string | null, phone: string | null): string | null {
  const digits = `${dialCode ?? ''}${phone ?? ''}`.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export async function findPublicSession(bookingId: string): Promise<PublicSessionView | null> {
  const id = bookingId.trim();
  if (!id) return null;
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT b.id, b.owner_user_id, b.agenda_id, b.start_at, b.end_at, b.price, b.modality,
              b.meet_url, b.status,
              b.payment_status, b.payment_method, b.paid_at,
              a.name AS agenda_name,
              p.full_name AS patient_name,
              pp.full_name AS practitioner_name,
              pp.currency AS currency,
              pp.address AS practitioner_address,
              pp.maps_url AS practitioner_maps_url,
              pp.phone AS practitioner_phone,
              pp.phone_country_code AS practitioner_phone_code,
              u.email AS practitioner_email
         FROM bookings b
         JOIN agendas a ON a.id = b.agenda_id
         JOIN patients p ON p.id = b.patient_id
         LEFT JOIN practitioner_profile pp ON pp.user_id = b.owner_user_id
         LEFT JOIN users u ON u.id = b.owner_user_id
        WHERE b.id = ?`,
    [id],
  )) as unknown as SessionRow | null;
  if (!row || !row.owner_user_id) return null;

  const startAt = new Date(row.start_at);
  const endAt = new Date(row.end_at);
  return {
    bookingId: row.id,
    ownerUserId: row.owner_user_id,
    agendaId: row.agenda_id,
    practitionerName: row.practitioner_name?.trim() || 'Profesional de la salud mental',
    agendaName: row.agenda_name ?? 'Sesión',
    patientFirstName: (row.patient_name ?? '').trim().split(/\s+/)[0] ?? '',
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: Math.max(0, differenceInMinutes(endAt, startAt)),
    modality: row.modality,
    price: row.price,
    currency: row.currency ?? 'MXN',
    status: row.status,
    paymentStatus: row.payment_status === 'pagada' ? 'pagada' : 'pendiente',
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    contact: {
      address: row.practitioner_address?.trim() || null,
      mapsUrl: row.practitioner_maps_url?.trim() || null,
      meetUrl: row.meet_url?.trim() || null,
      whatsapp: toWhatsappDigits(row.practitioner_phone_code, row.practitioner_phone),
      email: row.practitioner_email?.trim() || null,
    },
  };
}
