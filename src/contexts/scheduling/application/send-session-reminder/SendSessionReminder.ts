import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { PatientDirectory } from '../../domain/PatientDirectory';
import type { BookingNotifier } from '../../domain/BookingNotifier';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { PatientNotFoundInDirectoryError } from '../../domain/errors/PatientNotFoundInDirectoryError';
import { InvalidBookingTransitionError } from '../../domain/errors/InvalidBookingTransitionError';
import { SessionNotificationAssembler } from '../booking-notifications/SessionNotificationAssembler';

/** Envío manual del recordatorio de sesión (botón 🔔 de la UI). */
export class SendSessionReminder {
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

  public async send(bookingId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    if (!booking.canReceiveReminder()) {
      throw new InvalidBookingTransitionError('enviar recordatorio de', booking.toPrimitives().status);
    }
    const agenda = await this.agendas.findById(booking.agendaReference());
    if (!agenda) {
      throw new AgendaNotFoundError(booking.agendaReference());
    }
    const patient = await this.patients.findById(booking.patientReference());
    if (!patient) {
      throw new PatientNotFoundInDirectoryError(booking.patientReference());
    }
    await this.notifier.sessionReminder(await this.assembler.assemble(booking, agenda, patient));
  }
}
