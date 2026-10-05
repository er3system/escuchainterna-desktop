import { InvalidPaymentMethodError } from '../../domain/errors/InvalidPaymentMethodError';
import { PaymentMethod } from '../../domain/value-objects/PaymentMethod';

export class MarkBookingPaidMessage {
  private readonly id: string;
  private readonly paymentMethod: PaymentMethod;
  private readonly date: Date;

  public constructor(input: { bookingId: string; method: string; paidAt?: string }) {
    const bookingId = input.bookingId.trim();
    if (!bookingId) throw new Error('Falta el identificador de la reservación.');
    if (!PaymentMethod.isValid(input.method)) throw new InvalidPaymentMethodError(input.method);
    this.id = bookingId;
    this.paymentMethod = new PaymentMethod(input.method);
    const parsed = input.paidAt ? new Date(input.paidAt) : new Date();
    this.date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  public bookingId(): string {
    return this.id;
  }

  public method(): PaymentMethod {
    return this.paymentMethod;
  }

  public paidAt(): Date {
    return this.date;
  }
}
