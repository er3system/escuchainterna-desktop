import { parseBookingActor } from '../../domain/Booking';
import type { BookingActor } from '../../domain/Booking';
import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';

export class RescheduleBookingMessage {
  private readonly bookingId: string;
  private readonly newStart: Date;
  private readonly actor: BookingActor;

  public constructor(input: { bookingId: string; newStartIso: string; actor?: string }) {
    this.bookingId = (input.bookingId ?? '').trim();
    if (!this.bookingId) {
      throw new InvalidBookingDataError('se requiere la reservación a reagendar');
    }
    this.newStart = new Date(input.newStartIso);
    if (Number.isNaN(this.newStart.getTime())) {
      throw new InvalidBookingDataError(`fecha de inicio inválida «${input.newStartIso}»`);
    }
    this.actor = input.actor ? parseBookingActor(input.actor) : 'profesional';
  }

  public bookingIdValue(): string {
    return this.bookingId;
  }

  public newStartDate(): Date {
    return this.newStart;
  }

  public actorValue(): BookingActor {
    return this.actor;
  }
}
