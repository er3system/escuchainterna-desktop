import { InvalidPaymentMethodError } from '../../domain/errors/InvalidPaymentMethodError';
import { PaymentMethod } from '../../domain/value-objects/PaymentMethod';

export class MarkManyBookingsPaidMessage {
  private readonly ids: string[];
  private readonly paymentMethod: PaymentMethod;
  private readonly date: Date;

  public constructor(input: { bookingIds: string[]; method: string; paidAt?: string }) {
    const ids = Array.from(new Set(input.bookingIds.map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Selecciona al menos una sesión.');
    if (!PaymentMethod.isValid(input.method)) throw new InvalidPaymentMethodError(input.method);
    this.ids = ids;
    this.paymentMethod = new PaymentMethod(input.method);
    const parsed = input.paidAt ? new Date(input.paidAt) : new Date();
    this.date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  public bookingIds(): string[] {
    return [...this.ids];
  }

  public method(): PaymentMethod {
    return this.paymentMethod;
  }

  public paidAt(): Date {
    return this.date;
  }
}
