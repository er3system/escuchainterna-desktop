import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { BookingPaymentRepository } from '../../domain/repositories/BookingPaymentRepository';
import { MarkBookingUnpaidMessage } from './MarkBookingUnpaidMessage';

export class MarkBookingUnpaid {
  public constructor(private readonly payments: BookingPaymentRepository) {}

  public async markUnpaid(message: MarkBookingUnpaidMessage): Promise<void> {
    const payment = await this.payments.find(message.bookingId());
    if (!payment) throw new BookingNotFoundError(message.bookingId());
    payment.markUnpaid();
    await this.payments.save(payment);
  }
}
