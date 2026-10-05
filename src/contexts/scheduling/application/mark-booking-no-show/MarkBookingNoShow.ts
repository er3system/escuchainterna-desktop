import type { BookingPrimitives } from '../../domain/Booking';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';

export class MarkBookingNoShow {
  public constructor(
    private readonly bookings: BookingRepository,
    private readonly settings: SchedulingSettings,
  ) {}

  public async markAsNoShow(bookingId: string): Promise<BookingPrimitives> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    const defaults = await this.settings.getDefaults();
    booking.markAsNoShow(defaults.noShowFee);
    await this.bookings.save(booking);
    return booking.toPrimitives();
  }
}
