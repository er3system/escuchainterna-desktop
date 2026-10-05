import type { BookingPrimitives } from '../../domain/Booking';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { PatientDirectory } from '../../domain/PatientDirectory';
import type { BookingNotifier } from '../../domain/BookingNotifier';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { SessionNotificationAssembler } from '../booking-notifications/SessionNotificationAssembler';
import type { CancelBookingMessage } from './CancelBookingMessage';

export class CancelBooking {
  private readonly assembler: SessionNotificationAssembler;

  public constructor(
    private readonly bookings: BookingRepository,
    private readonly agendas: AgendaRepository,
    private readonly patients: PatientDirectory,
    private readonly settings: SchedulingSettings,
    private readonly notifier: BookingNotifier,
  ) {
    this.assembler = new SessionNotificationAssembler(settings);
  }

  public async cancel(message: CancelBookingMessage, now: Date = new Date()): Promise<BookingPrimitives> {
    const booking = await this.bookings.findById(message.bookingIdValue());
    if (!booking) {
      throw new BookingNotFoundError(message.bookingIdValue());
    }
    const defaults = await this.settings.getDefaults();
    booking.cancel(message.actorValue(), defaults.cancellationMinHours, now, defaults.lateCancelFee);
    await this.bookings.save(booking);

    const agenda = await this.agendas.findById(booking.agendaReference());
    const patient = await this.patients.findById(booking.patientReference());
    if (agenda && patient) {
      await this.notifier.sessionCancelled(await this.assembler.assemble(booking, agenda, patient));
    }
    return booking.toPrimitives();
  }
}
