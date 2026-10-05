import type { BookingPrimitives } from '../../domain/Booking';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';

export class CompleteBooking {
  public constructor(private readonly bookings: BookingRepository) {}

  public async complete(bookingId: string): Promise<BookingPrimitives> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    booking.complete();
    await this.bookings.save(booking);
    return booking.toPrimitives();
  }
}
