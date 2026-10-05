'use server';

import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireReception } from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { CreateBookingMessage } from '@/contexts/scheduling/application/create-booking/CreateBookingMessage';
import { FindAvailableSlotsQuery } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlotsQuery';
import type { DayAvailableSlots } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlots';
import { receptionCanScheduleFor, loadProfessionalBookingContext } from './recepcionData';
import type { ProfessionalBookingContext } from './recepcionData';
import { stampBookingsConsultorio } from '../agenda/bookingConsultorio';
import type { AgendaActionState, CreateBookingActionInput } from '../agenda/actions';

/**
 * Gate ÚNICO de toda acción de la recepción sobre la agenda de un profesional (§5):
 * (1) la sesión debe ser una RECEPCIÓN activa (requireReception: cuenta de recepción +
 * org habilitada); (2) el profesional destino debe ser un miembro que atiende de uno de
 * los consultorios de ESTA recepción (receptionCanScheduleFor). Si algo falla, 404 (no
 * se revela nada). Devuelve el id del profesional = dueño con el que se acota la agenda.
 * El professionalUserId viene del cliente pero SIEMPRE se revalida aquí contra el
 * alcance de la sesión: nunca se confía en el valor que manda el navegador.
 */
async function resolveReceptionTarget(professionalUserId: string): Promise<string> {
  const { organizationId, consultorioIds } = await requireReception();
  if (
    !professionalUserId ||
    !(await receptionCanScheduleFor(organizationId, consultorioIds, professionalUserId))
  ) {
    notFound();
  }
  return professionalUserId;
}

/** Contexto de agenda del profesional (agendas, pacientes, moneda) para abrir el modal. */
export async function getReceptionProfessionalContextAction(
  professionalUserId: string,
): Promise<{ context?: ProfessionalBookingContext; error?: string }> {
  try {
    const ownerUserId = await resolveReceptionTarget(professionalUserId);
    return { context: await loadProfessionalBookingContext(ownerUserId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo cargar la agenda del profesional.' };
  }
}

/** Horarios disponibles de una agenda del profesional destino (acotado a él). */
export async function getReceptionAvailableSlotsAction(
  professionalUserId: string,
  input: { agendaId: string; fromDate: string; days?: number },
): Promise<{ days: DayAvailableSlots[]; error?: string }> {
  try {
    const ownerUserId = await resolveReceptionTarget(professionalUserId);
    const query = new FindAvailableSlotsQuery({
      agendaId: input.agendaId,
      fromDate: input.fromDate,
      days: input.days ?? 1,
    });
    return { days: await createSchedulingUseCases(ownerUserId).findAvailableSlots.find(query) };
  } catch (error) {
    return { days: [], error: error instanceof Error ? error.message : 'No se pudo calcular la disponibilidad.' };
  }
}

/**
 * La recepción crea una cita PARA el profesional destino. ESCRITURA cross-owner: la cita
 * queda con owner = profesional (no la recepción), tras validar el gate. Reusa el mismo
 * caso de uso CreateBooking acotado al profesional, así que toda la validación de cupo
 * (solapes, disponibilidad, bloqueos) y los avisos salen como si la creara el profesional.
 */
export async function createReceptionBookingAction(
  professionalUserId: string,
  input: CreateBookingActionInput,
): Promise<AgendaActionState> {
  let ownerUserId: string;
  try {
    ownerUserId = await resolveReceptionTarget(professionalUserId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No autorizado.' };
  }
  try {
    const startAtIso = new Date(`${input.date}T${input.time}:00`).toISOString();
    const message = new CreateBookingMessage({
      agendaId: input.agendaId,
      patientId: input.patientId,
      contact: input.contact,
      startAtIso,
      price: input.price,
      currency: input.currency,
      modality: input.modality,
      recurrence: input.recurrence,
      patientNote: input.patientNote,
      bookedBy: 'profesional',
    });
    await getDatabaseAdapter().transaction(async () => {
      const created = await createSchedulingUseCases(ownerUserId).createBooking.create(message);
      if (input.consultorioId) {
        await stampBookingsConsultorio(ownerUserId, created.map((booking) => booking.id), input.consultorioId);
      }
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear la reservación.' };
  }
  revalidatePath('/recepcion');
  return { ok: true };
}
