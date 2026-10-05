'use server';

import { revalidatePath } from 'next/cache';
import {
  ownerCanActuallyCharge,
  requireDataOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';
import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import { writeWhatsappOrOmit } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { CreateBookingMessage } from '@/contexts/scheduling/application/create-booking/CreateBookingMessage';
import { RescheduleBookingMessage } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBookingMessage';
import { CancelBookingMessage } from '@/contexts/scheduling/application/cancel-booking/CancelBookingMessage';
import { FindAvailableSlotsQuery } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlotsQuery';
import { GetBookingDetail } from '@/contexts/scheduling/application/get-booking-detail/GetBookingDetail';
import type { BookingDetail } from '@/contexts/scheduling/application/get-booking-detail/GetBookingDetail';
import type { DayAvailableSlots } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlots';
import { SqliteAgendaRepository } from '@/contexts/scheduling/infrastructure/persistence/SqliteAgendaRepository';
import { SqliteBookingRepository } from '@/contexts/scheduling/infrastructure/persistence/SqliteBookingRepository';
import { SqlitePatientDirectory } from '@/contexts/scheduling/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteSchedulingSettings } from '@/contexts/scheduling/infrastructure/persistence/SqliteSchedulingSettings';
import { stampBookingsConsultorio } from './bookingConsultorio';
import { listMessagesForBooking } from './bookingOutbox';
import type { BookingMessage } from './agendaTypes';

export interface AgendaActionState {
  ok: boolean;
  error?: string;
}

function refreshAgendaPaths(): void {
  revalidatePath('/agenda');
  revalidatePath('/pagos');
  revalidatePath('/inicio');
  revalidatePath('/mensajes');
}

async function run(action: () => Promise<void>): Promise<AgendaActionState> {
  try {
    await action();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' };
  }
  refreshAgendaPaths();
  return { ok: true };
}

export interface CreateBookingActionInput {
  agendaId: string;
  patientId?: string;
  contact?: { fullName: string; email?: string; phone?: string };
  /** Fecha 'yyyy-MM-dd' y hora 'HH:mm' locales. */
  date: string;
  time: string;
  price?: number;
  /** Moneda puntual de la reserva; si se omite se usa la efectiva de la agenda. */
  currency?: string;
  modality?: string;
  recurrence?: { frequency: string; repeatCount: number };
  /** Nota / motivo opcional de la reserva. */
  patientNote?: string;
  /** Sede de la sesión (Modo Sedes, MS3); solo aplica si la org está en modo 'compartido'. */
  consultorioId?: string;
}

export async function createBookingAction(input: CreateBookingActionInput): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  const canActuallyCharge = await ownerCanActuallyCharge(ownerUserId);
  return run(async () => {
    const startAtIso = new Date(`${input.date}T${input.time}:00`).toISOString();
    const message = new CreateBookingMessage({
      agendaId: input.agendaId,
      patientId: input.patientId,
      contact: input.contact,
      startAtIso,
      // El precio que llega del cliente nunca puede reactivar pagos que la
      // organización haya deshabilitado para este miembro.
      price: canActuallyCharge ? input.price : 0,
      currency: input.currency,
      modality: input.modality,
      recurrence: input.recurrence,
      patientNote: input.patientNote,
      bookedBy: 'profesional',
    });
    // Serie recurrente: recurrence + las N reservas se crean atómicas (o la serie
    // completa o nada). La reserva pública es una sola (sin recurrencia), por eso
    // solo el alta del profesional necesita la transacción. La sede (MS3) se sella
    // dentro de la misma transacción sobre las reservas creadas.
    await getDatabaseAdapter().transaction(async () => {
      const created = await createSchedulingUseCases(ownerUserId).createBooking.create(message);
      if (input.consultorioId) {
        await stampBookingsConsultorio(ownerUserId, created.map((booking) => booking.id), input.consultorioId);
      }
    });
  });
}

export async function rescheduleBookingAction(input: {
  bookingId: string;
  date: string;
  time: string;
}): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    const newStartIso = new Date(`${input.date}T${input.time}:00`).toISOString();
    const message = new RescheduleBookingMessage({
      bookingId: input.bookingId,
      newStartIso,
      actor: 'profesional',
    });
    await createSchedulingUseCases(ownerUserId).rescheduleBooking.reschedule(message);
  });
}

export async function cancelBookingAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    const message = new CancelBookingMessage({ bookingId, actor: 'profesional' });
    await createSchedulingUseCases(ownerUserId).cancelBooking.cancel(message);
  });
}

export async function confirmBookingAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    await createSchedulingUseCases(ownerUserId).confirmBooking.confirm(bookingId);
  });
}

export async function completeBookingAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    await createSchedulingUseCases(ownerUserId).completeBooking.complete(bookingId);
  });
}

export async function markNoShowAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    await createSchedulingUseCases(ownerUserId).markBookingNoShow.markAsNoShow(bookingId);
  });
}

export async function sendReminderAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    await createSchedulingUseCases(ownerUserId).sendSessionReminder.send(bookingId);
  });
}

/**
 * «Reenviar link de gestión» (v3-spec §6): registra en el outbox (WhatsApp +
 * correo) el mensaje con la liga pública /sesion/<id> desde la que el paciente
 * puede ver el detalle, pagar, reagendar o cancelar su sesión.
 */
export async function resendManagementLinkAction(bookingId: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    const detail = await new GetBookingDetail(
      new SqliteBookingRepository(ownerUserId),
      new SqliteAgendaRepository(ownerUserId),
      new SqlitePatientDirectory(ownerUserId),
      new SqliteSchedulingSettings(ownerUserId),
    ).get(bookingId);
    const practitionerName =
      (await new SqliteSchedulingSettings(ownerUserId).getDefaults()).practitionerName.trim() ||
      'tu profesional';
    const link = `${getAppBaseUrl()}/sesion/${detail.booking.id}`;
    const body = [
      '🔗 Gestión de tu sesión',
      `Hola ${detail.patient.fullName}, desde esta liga puedes ver el detalle de tu sesión con *${practitionerName}*, pagarla, reagendarla o cancelarla:`,
      '',
      link,
      '',
      'Mensaje automatizado: no responder a este mensaje.',
    ].join('\n');
    const subject = 'Liga de gestión de tu sesión';
    // Decisión de canal (v3-spec §5): el WhatsApp respeta el presupuesto del
    // plan; si el mes ya se agotó queda 'omitido' y el correo (abajo) sale igual.
    await writeWhatsappOrOmit({
      recipient: detail.patient.phone || detail.patient.email,
      recipientName: detail.patient.fullName,
      template: 'liga_gestion',
      subject,
      body,
      bookingId: detail.booking.id,
      patientId: detail.patient.id,
      ownerUserId,
    });
    await writeOutboxMessage({
      channel: 'email',
      recipient: detail.patient.email || detail.patient.phone,
      recipientName: detail.patient.fullName,
      template: 'liga_gestion',
      subject,
      body: await wrapEmailBodyForOwner(ownerUserId, body),
      bookingId: detail.booking.id,
      patientId: detail.patient.id,
      ownerUserId,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo reenviar la liga.' };
  }
  revalidatePath('/mensajes');
  return { ok: true };
}

export async function getBookingDetailAction(
  bookingId: string,
): Promise<{ detail?: BookingDetail; sedeName?: string | null; error?: string }> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    const detail = await new GetBookingDetail(
      new SqliteBookingRepository(ownerUserId),
      new SqliteAgendaRepository(ownerUserId),
      new SqlitePatientDirectory(ownerUserId),
      new SqliteSchedulingSettings(ownerUserId),
    ).get(bookingId);
    // Sede de la sesión (Modo Sedes, MS3): nombre de la sede sellada en la reserva (o null).
    const sede = (await getDatabaseAdapter().queryRow(
      `SELECT c.name AS name FROM bookings b
           LEFT JOIN consultorios c ON c.id = b.consultorio_id AND c.archived = 0
          WHERE b.id = ? AND b.owner_user_id = ?`,
      [bookingId, ownerUserId],
    )) as { name: string | null } | null;
    return { detail, sedeName: sede?.name ?? null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo cargar la reservación.' };
  }
}

export async function getBookingMessagesAction(
  bookingId: string,
): Promise<{ messages: BookingMessage[]; error?: string }> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    return { messages: await listMessagesForBooking(bookingId, ownerUserId) };
  } catch (error) {
    return {
      messages: [],
      error: error instanceof Error ? error.message : 'No se pudieron cargar los mensajes.',
    };
  }
}

/**
 * Crea un espacio bloqueado manual (no es un paciente): tapa la disponibilidad
 * de TODAS las agendas del profesional en ese rango. `date` 'yyyy-MM-dd';
 * `start`/`end` 'HH:mm' locales.
 */
export async function createBlockedSlotAction(input: {
  date: string;
  start: string;
  end: string;
  title?: string;
}): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    const startAtIso = new Date(`${input.date}T${input.start}:00`).toISOString();
    const endAtIso = new Date(`${input.date}T${input.end}:00`).toISOString();
    await createSchedulingUseCases(ownerUserId).createBlockedSlot.create({
      startAtIso,
      endAtIso,
      title: input.title,
    });
  });
}

export async function deleteBlockedSlotAction(id: string): Promise<AgendaActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  return run(async () => {
    await createSchedulingUseCases(ownerUserId).deleteBlockedSlot.delete(id);
  });
}

export async function getAvailableSlotsAction(input: {
  agendaId: string;
  fromDate: string;
  days?: number;
}): Promise<{ days: DayAvailableSlots[]; error?: string }> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    const query = new FindAvailableSlotsQuery({
      agendaId: input.agendaId,
      fromDate: input.fromDate,
      days: input.days ?? 1,
    });
    return { days: await createSchedulingUseCases(ownerUserId).findAvailableSlots.find(query) };
  } catch (error) {
    return {
      days: [],
      error: error instanceof Error ? error.message : 'No se pudo calcular la disponibilidad.',
    };
  }
}
