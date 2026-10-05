import { PaymentMethod } from './value-objects/PaymentMethod';

export interface BookingPaymentPrimitives {
  bookingId: string;
  paymentStatus: 'pendiente' | 'pagada';
  paymentMethod: string | null;
  paidAt: string | null;
}

/**
 * Vista de escritura del estado de pago de una reservación.
 * Billing no es dueño del agregado Booking (scheduling lo es): este objeto
 * solo gobierna la transición pendiente ⇄ pagada y sus sellos.
 */
export class BookingPayment {
  private constructor(
    private readonly bookingId: string,
    private paymentStatus: 'pendiente' | 'pagada',
    private paymentMethod: string | null,
    private paidAt: Date | null,
  ) {}

  public static fromPrimitives(primitives: BookingPaymentPrimitives): BookingPayment {
    return new BookingPayment(
      primitives.bookingId,
      primitives.paymentStatus,
      primitives.paymentMethod,
      primitives.paidAt ? new Date(primitives.paidAt) : null,
    );
  }

  public markPaid(method: PaymentMethod, paidAt: Date): void {
    this.paymentStatus = 'pagada';
    this.paymentMethod = method.valueOf();
    this.paidAt = paidAt;
  }

  public markUnpaid(): void {
    this.paymentStatus = 'pendiente';
    this.paymentMethod = null;
    this.paidAt = null;
  }

  public isPaid(): boolean {
    return this.paymentStatus === 'pagada';
  }

  public toPrimitives(): BookingPaymentPrimitives {
    return {
      bookingId: this.bookingId,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      paidAt: this.paidAt ? this.paidAt.toISOString() : null,
    };
  }
}
