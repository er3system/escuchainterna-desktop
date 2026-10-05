import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { BookingPaymentRepository } from '../../domain/repositories/BookingPaymentRepository';
import { MarkBookingPaidMessage } from './MarkBookingPaidMessage';

export class MarkBookingPaid {
  public constructor(private readonly payments: BookingPaymentRepository) {}

  public async markPaid(message: MarkBookingPaidMessage): Promise<void> {
    const payment = await this.payments.find(message.bookingId());
    if (!payment) throw new BookingNotFoundError(message.bookingId());
    payment.markPaid(message.method(), message.paidAt());
    await this.payments.save(payment);
  }
}
