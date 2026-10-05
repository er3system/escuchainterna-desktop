import type { BookingPrimitives } from '../../domain/Booking';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';

export class ConfirmBooking {
  public constructor(private readonly bookings: BookingRepository) {}

  public async confirm(bookingId: string): Promise<BookingPrimitives> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    booking.confirm();
    await this.bookings.save(booking);
    return booking.toPrimitives();
  }
}
