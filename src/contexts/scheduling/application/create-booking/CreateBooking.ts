import { randomUUID } from 'node:crypto';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { Booking } from '../../domain/Booking';
import type { BookingModality, BookingPrimitives } from '../../domain/Booking';
import type { Agenda, AgendaModality } from '../../domain/Agenda';
import { Recurrence } from '../../domain/Recurrence';
import { WeeklyAvailability } from '../../domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { PatientContact, PatientDirectory } from '../../domain/PatientDirectory';
import type { MeetingLinkProvider } from '../../domain/MeetingLinkProvider';
import type { BookingNotifier } from '../../domain/BookingNotifier';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { PatientNotFoundInDirectoryError } from '../../domain/errors/PatientNotFoundInDirectoryError';
import { BookingOutsideAvailabilityError } from '../../domain/errors/BookingOutsideAvailabilityError';
import { BookingOverlapError } from '../../domain/errors/BookingOverlapError';
import { BookingTooSoonError } from '../../domain/errors/BookingTooSoonError';
import { BlockedSlotConflictError } from '../../domain/errors/BlockedSlotConflictError';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';
import { SessionNotificationAssembler } from '../booking-notifications/SessionNotificationAssembler';
import type { CreateBookingMessage } from './CreateBookingMessage';

/**
 * Crea una reservación (o una serie completa si hay recurrencia).
 * - Valida solapamiento contra reservas no canceladas (siempre).
 * - Valida disponibilidad y colchón de horas mínimas cuando agenda el paciente.
 * - Genera liga de videollamada si la modalidad es virtual.
 * - Notifica «sesión agendada»: todas si la serie es corta; solo la primera si es larga.
 */
export class CreateBooking {
  private static readonly MAX_NOTIFIED_SERIES = 3;

  private readonly assembler: SessionNotificationAssembler;

  public constructor(
    private readonly agendas: AgendaRepository,
    private readonly bookings: BookingRepository,
    private readonly patients: PatientDirectory,
    private readonly meetingLinks: MeetingLinkProvider,
    private readonly notifier: BookingNotifier,
    private readonly settings: SchedulingSettings,
    /** Bloqueos manuales (almuerzo/vacaciones). Opcional; la fábrica SIEMPRE lo inyecta. */
    private readonly blockedSlots?: BlockedSlotRepository,
  ) {
    this.assembler = new SessionNotificationAssembler(settings);
  }

  public async create(message: CreateBookingMessage, now: Date = new Date()): Promise<BookingPrimitives[]> {
    const agenda = await this.agendas.findById(message.agendaIdValue());
    if (!agenda || (!agenda.isActive() && message.bookedByValue() === 'paciente')) {
      throw new AgendaNotFoundError(message.agendaIdValue());
    }
    const patient = await this.resolvePatient(message);
    const defaults = await this.settings.getDefaults();
    const availability = agenda.effectiveAvailability(
      WeeklyAvailability.fromPrimitives(defaults.availability),
    );
    const location = agenda.effectiveLocation({
      modality: defaults.modality,
      address: defaults.address,
      mapsUrl: defaults.mapsUrl,
    });
    const payment = agenda.effectivePrice({
      price: defaults.defaultPrice,
      paymentMode: defaults.paymentMode,
      showPrice: defaults.showPrice,
      currency: defaults.currency,
      paymentsEnabled: defaults.paymentsEnabled,
    });
    const modality = CreateBooking.resolveModality(message.modalityPreference(), location.modality);
    const price = defaults.paymentsEnabled === false ? 0 : (message.priceValue() ?? payment.price);
    // Moneda del cobro: la explícita de la reserva ("usar otra moneda") o la
    // efectiva de la agenda (override de la agenda || moneda del perfil).
    const currency = message.currencyValue() ?? payment.currency;

    const recurrenceInput = message.recurrenceInput();
    const recurrence = recurrenceInput
      ? Recurrence.create(randomUUID(), recurrenceInput.frequency, recurrenceInput.repeatCount)
      : null;
    const starts = recurrence ? recurrence.expandFrom(message.startDate()) : [message.startDate()];

    for (const start of starts) {
      await this.ensureSlotIsBookable(message, agenda, availability, start, now);
    }

    if (recurrence) {
      await this.bookings.saveRecurrence(recurrence);
    }

    const created: Booking[] = [];
    for (const start of starts) {
      const bookingId = randomUUID();
      const meetUrl = modality === 'virtual' ? this.meetingLinks.createMeetingLink(bookingId) : null;
      const booking = Booking.create({
        id: bookingId,
        agendaId: agenda.agendaId(),
        patientId: patient.id,
        startAt: start,
        endAt: agenda.endFor(start),
        price,
        currency,
        modality,
        meetUrl,
        recurrenceId: recurrence ? recurrence.recurrenceId() : null,
        bookedBy: message.bookedByValue(),
        patientNote: message.patientNoteValue(),
      });
      await this.bookings.save(booking);
      created.push(booking);
    }

    const notifyAll = created.length <= CreateBooking.MAX_NOTIFIED_SERIES;
    for (let index = 0; index < created.length; index += 1) {
      if (index === 0 || notifyAll) {
        await this.notifier.sessionBooked(
          await this.assembler.assemble(created[index], agenda, patient),
        );
      }
    }

    return created.map((booking) => booking.toPrimitives());
  }

  private async resolvePatient(message: CreateBookingMessage): Promise<PatientContact> {
    const patientId = message.patientIdValue();
    if (patientId) {
      const found = await this.patients.findById(patientId);
      if (!found) {
        throw new PatientNotFoundInDirectoryError(patientId);
      }
      return found;
    }
    const contact = message.contactValue();
    if (!contact) {
      throw new PatientNotFoundInDirectoryError('sin datos de contacto');
    }
    return this.patients.findOrCreateByContact(contact);
  }

  private async ensureSlotIsBookable(
    message: CreateBookingMessage,
    agenda: Agenda,
    availability: WeeklyAvailability,
    start: Date,
    now: Date,
  ): Promise<void> {
    if (message.bookedByValue() === 'paciente') {
      if (differenceInMinutes(start, now) < agenda.minimumBookingHours() * 60) {
        throw new BookingTooSoonError(agenda.minimumBookingHours());
      }
      if (!availability.isAvailableAt(start, agenda.sessionDurationMinutes())) {
        throw new BookingOutsideAvailabilityError(start);
      }
    }
    // El bloque ocupado incluye el colchón posterior; el solape se mide contra ese bloque
    // y con el colchón hacia atrás, igual que FindAvailableSlots (al menos buffer entre sesiones).
    const bufferMinutes = agenda.bufferAfterMinutes();
    const occupiedEnd = agenda.occupiedEndFor(start);
    // Bloqueos manuales (almuerzo/vacaciones) tapan el cupo para TODOS, no solo en la UI.
    if (this.blockedSlots) {
      const blocks = await this.blockedSlots.findBetween(start, occupiedEnd);
      if (blocks.some((block) => block.overlaps(start, occupiedEnd))) {
        throw new BlockedSlotConflictError(start);
      }
    }
    const overlapping = await this.bookings.findOverlapping(
      addMinutes(start, -bufferMinutes),
      occupiedEnd,
    );
    if (overlapping.length > 0) {
      throw new BookingOverlapError(start);
    }
  }

  private static resolveModality(
    preference: BookingModality | null,
    agendaModality: AgendaModality,
  ): BookingModality {
    if (agendaModality === 'ambas') {
      return preference ?? 'presencial';
    }
    return agendaModality;
  }
}
