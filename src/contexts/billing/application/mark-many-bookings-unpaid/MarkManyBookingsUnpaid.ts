import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { BookingPaymentRepository } from '../../domain/repositories/BookingPaymentRepository';
import { MarkManyBookingsUnpaidMessage } from './MarkManyBookingsUnpaidMessage';

/** Devuelve varias sesiones a estado pendiente (v2-spec §6.14). */
export class MarkManyBookingsUnpaid {
  public constructor(private readonly payments: BookingPaymentRepository) {}

  public async markUnpaid(message: MarkManyBookingsUnpaidMessage): Promise<void> {
    for (const bookingId of message.bookingIds()) {
      const payment = await this.payments.find(bookingId);
      if (!payment) throw new BookingNotFoundError(bookingId);
      payment.markUnpaid();
      await this.payments.save(payment);
    }
  }
}
