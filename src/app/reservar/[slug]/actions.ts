'use server';

import { revalidatePath } from 'next/cache';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { FindAvailableSlotsQuery } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlotsQuery';
import { RequestPublicBookingMessage } from '@/contexts/scheduling/application/request-public-booking/RequestPublicBookingMessage';
import type { DayAvailableSlots } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlots';
import {
  resolveOwnerByAgendaId,
  resolveOwnerByPublicSlug,
} from '@/contexts/identity/infrastructure/persistence/SqlitePublicSlugResolver';
import { ownerHasActiveAppAccess } from '@/shared/infrastructure/auth/dataOwner';

export async function getPublicSlotsAction(input: {
  agendaId: string;
  fromDate: string;
  days: number;
}): Promise<{ days: DayAvailableSlots[]; error?: string }> {
  try {
    // Página pública: el owner se resuelve desde la agenda, no desde la sesión.
    const ownerUserId = await resolveOwnerByAgendaId(input.agendaId);
    if (!ownerUserId) return { days: [], error: 'La agenda ya no está disponible.' };
    if (!(await ownerHasActiveAppAccess(ownerUserId))) {
      return { days: [], error: 'La agenda ya no está disponible.' };
    }
    const query = new FindAvailableSlotsQuery({
      agendaId: input.agendaId,
      fromDate: input.fromDate,
      days: input.days,
    });
    return { days: await createSchedulingUseCases(ownerUserId).findAvailableSlots.find(query) };
  } catch (error) {
    return {
      days: [],
      error: error instanceof Error ? error.message : 'No se pudo cargar la disponibilidad.',
    };
  }
}

export interface PublicBookingResult {
  ok: boolean;
  error?: string;
  booking?: {
    /** Id de la reserva: permite enlazar a la página pública /sesion/[bookingId]. */
    bookingId: string;
    startAt: string;
    endAt: string;
    modality: string;
    meetUrl: string | null;
    price: number;
  };
}

export async function requestPublicBookingAction(input: {
  agendaSlug: string;
  fullName: string;
  email: string;
  phone: string;
  /** Indicativo del país elegido en el PhoneInput (p. ej. «+52»). */
  phoneCountryCode?: string;
  date: string;
  time: string;
  modality?: string;
  /** Nota / motivo de consulta que escribe el paciente (opcional). */
  patientNote?: string;
}): Promise<PublicBookingResult> {
  try {
    // El owner del slug es quien "posee" al paciente y la reserva creados aquí.
    const ownerUserId = await resolveOwnerByPublicSlug(input.agendaSlug);
    if (!ownerUserId) return { ok: false, error: 'La agenda ya no está disponible.' };
    if (!(await ownerHasActiveAppAccess(ownerUserId))) {
      return { ok: false, error: 'La agenda ya no está disponible.' };
    }
    const startAtIso = new Date(`${input.date}T${input.time}:00`).toISOString();
    const message = new RequestPublicBookingMessage({
      slug: input.agendaSlug,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      phoneCountryCode: input.phoneCountryCode,
      startAtIso,
      modality: input.modality,
      patientNote: input.patientNote,
    });
    // Atómico y protegido contra carreras: el chequeo de solape + el alta corren dentro de
    // la transacción del adaptador (BEGIN IMMEDIATE en SQLite, SERIALIZABLE en Postgres).
    // Ante dos reservas simultáneas incompatibles, una se rechaza; la restricción única
    // refuerza además el caso del mismo inicio. La notificación sale solo tras el commit.
    const booking = await getDatabaseAdapter().transaction(() =>
      createSchedulingUseCases(ownerUserId).requestPublicBooking.request(message),
    );
    revalidatePath('/agenda');
    revalidatePath('/mensajes');
    revalidatePath('/inicio');
    return {
      ok: true,
      booking: {
        bookingId: booking.id,
        startAt: booking.startAt,
        endAt: booking.endAt,
        modality: booking.modality,
        meetUrl: booking.meetUrl,
        price: booking.price,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo agendar la sesión.',
    };
  }
}
