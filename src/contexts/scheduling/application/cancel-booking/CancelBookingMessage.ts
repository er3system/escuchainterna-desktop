import { parseBookingActor } from '../../domain/Booking';
import type { BookingActor } from '../../domain/Booking';
import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';

export class CancelBookingMessage {
  private readonly bookingId: string;
  private readonly actor: BookingActor;

  public constructor(input: { bookingId: string; actor?: string }) {
    this.bookingId = (input.bookingId ?? '').trim();
    if (!this.bookingId) {
      throw new InvalidBookingDataError('se requiere la reservación a cancelar');
    }
    this.actor = input.actor ? parseBookingActor(input.actor) : 'profesional';
  }

  public bookingIdValue(): string {
    return this.bookingId;
  }

  public actorValue(): BookingActor {
    return this.actor;
  }
}
