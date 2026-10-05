import { InvoiceFolio } from './value-objects/InvoiceFolio';
import { MoneyAmount } from './value-objects/MoneyAmount';

export interface InvoicePrimitives {
  id: string;
  bookingId: string;
  patientId: string;
  folio: string;
  amount: number;
  currency: string;
  outboxMessageId: string | null;
  sentAt: string;
}

/**
 * Factura simple emitida por el profesional sobre una sesión pagada
 * (v2-spec §6.13): folio consecutivo + registro del correo enviado.
 */
export class Invoice {
  private constructor(
    private readonly id: string,
    private readonly bookingId: string,
    private readonly patientId: string,
    private readonly folio: InvoiceFolio,
    private readonly amount: MoneyAmount,
    private readonly currency: string,
    private readonly outboxMessageId: string | null,
    private readonly sentAt: Date,
  ) {}

  public static issue(input: {
    id: string;
    bookingId: string;
    patientId: string;
    folio: InvoiceFolio;
    amount: number;
    currency: string;
    outboxMessageId: string | null;
    sentAt: Date;
  }): Invoice {
    return new Invoice(
      input.id,
      input.bookingId,
      input.patientId,
      input.folio,
      new MoneyAmount(input.amount),
      input.currency,
      input.outboxMessageId,
      input.sentAt,
    );
  }

  public static fromPrimitives(primitives: InvoicePrimitives): Invoice {
    return new Invoice(
      primitives.id,
      primitives.bookingId,
      primitives.patientId,
      InvoiceFolio.fromString(primitives.folio),
      new MoneyAmount(primitives.amount),
      primitives.currency,
      primitives.outboxMessageId,
      new Date(primitives.sentAt),
    );
  }

  public toPrimitives(): InvoicePrimitives {
    return {
      id: this.id,
      bookingId: this.bookingId,
      patientId: this.patientId,
      folio: this.folio.valueOf(),
      amount: this.amount.valueOf(),
      currency: this.currency,
      outboxMessageId: this.outboxMessageId,
      sentAt: this.sentAt.toISOString(),
    };
  }
}
