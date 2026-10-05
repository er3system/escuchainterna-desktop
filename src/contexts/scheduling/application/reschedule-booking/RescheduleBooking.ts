import { addMinutes, differenceInMinutes } from 'date-fns';
import type { BookingPrimitives } from '../../domain/Booking';
import { WeeklyAvailability } from '../../domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';
import type { PatientDirectory } from '../../domain/PatientDirectory';
import type { BookingNotifier } from '../../domain/BookingNotifier';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { BookingOverlapError } from '../../domain/errors/BookingOverlapError';
import { BookingOutsideAvailabilityError } from '../../domain/errors/BookingOutsideAvailabilityError';
import { BookingTooSoonError } from '../../domain/errors/BookingTooSoonError';
import { BlockedSlotConflictError } from '../../domain/errors/BlockedSlotConflictError';
import { SessionNotificationAssembler } from '../booking-notifications/SessionNotificationAssembler';
import type { RescheduleBookingMessage } from './RescheduleBookingMessage';

export class RescheduleBooking {
  private readonly assembler: SessionNotificationAssembler;

  public constructor(
    private readonly bookings: BookingRepository,
    private readonly agendas: AgendaRepository,
    private readonly patients: PatientDirectory,
    private readonly settings: SchedulingSettings,
    private readonly notifier: BookingNotifier,
    /** Bloqueos manuales (almuerzo/vacaciones). Opcional; la fábrica SIEMPRE lo inyecta. */
    private readonly blockedSlots?: BlockedSlotRepository,
  ) {
    this.assembler = new SessionNotificationAssembler(settings);
  }

  public async reschedule(
    message: RescheduleBookingMessage,
    now: Date = new Date(),
  ): Promise<BookingPrimitives> {
    const booking = await this.bookings.findById(message.bookingIdValue());
    if (!booking) {
      throw new BookingNotFoundError(message.bookingIdValue());
    }
    const agenda = await this.agendas.findById(booking.agendaReference());
    if (!agenda) {
      throw new AgendaNotFoundError(booking.agendaReference());
    }
    const defaults = await this.settings.getDefaults();
    const newStart = message.newStartDate();
    const bufferMinutes = agenda.bufferAfterMinutes();
    const occupiedEnd = agenda.occupiedEndFor(newStart);

    if (message.actorValue() === 'paciente') {
      // Anticipación mínima: reagendar no debe evadir el colchón de horas que sí exige crear.
      if (differenceInMinutes(newStart, now) < agenda.minimumBookingHours() * 60) {
        throw new BookingTooSoonError(agenda.minimumBookingHours());
      }
      const availability = agenda.effectiveAvailability(
        WeeklyAvailability.fromPrimitives(defaults.availability),
      );
      if (!availability.isAvailableAt(newStart, booking.durationMinutes())) {
        throw new BookingOutsideAvailabilityError(newStart);
      }
    }
    // Bloqueos manuales (almuerzo/vacaciones) también valen al reagendar.
    if (this.blockedSlots) {
      const blocks = await this.blockedSlots.findBetween(newStart, occupiedEnd);
      if (blocks.some((block) => block.overlaps(newStart, occupiedEnd))) {
        throw new BlockedSlotConflictError(newStart);
      }
    }
    // Solape con reservas + colchón simétrico (excluyendo la propia reserva).
    const overlapping = await this.bookings.findOverlapping(
      addMinutes(newStart, -bufferMinutes),
      occupiedEnd,
      booking.bookingId(),
    );
    if (overlapping.length > 0) {
      throw new BookingOverlapError(newStart);
    }
    const newEnd = addMinutes(newStart, booking.durationMinutes());

    booking.reschedule(newStart, newEnd, message.actorValue(), defaults.cancellationMinHours, now);
    await this.bookings.save(booking);

    const patient = await this.patients.findById(booking.patientReference());
    if (patient) {
      await this.notifier.sessionRescheduled(await this.assembler.assemble(booking, agenda, patient));
    }
    return booking.toPrimitives();
  }
}
