import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { BookingPaymentRepository } from '../../domain/repositories/BookingPaymentRepository';
import { MarkManyBookingsPaidMessage } from './MarkManyBookingsPaidMessage';

/**
 * Marca varias sesiones como pagadas con un mismo método y fecha
 * (v2-spec §6.14: paquetes de 4/10 con descuento).
 */
export class MarkManyBookingsPaid {
  public constructor(private readonly payments: BookingPaymentRepository) {}

  public async markPaid(message: MarkManyBookingsPaidMessage): Promise<void> {
    for (const bookingId of message.bookingIds()) {
      const payment = await this.payments.find(bookingId);
      if (!payment) throw new BookingNotFoundError(bookingId);
      payment.markPaid(message.method(), message.paidAt());
      await this.payments.save(payment);
    }
  }
}
