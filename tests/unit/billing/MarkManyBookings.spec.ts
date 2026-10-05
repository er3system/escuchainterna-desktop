import { describe, expect, it } from 'vitest';
import { MarkManyBookingsPaid } from '@/contexts/billing/application/mark-many-bookings-paid/MarkManyBookingsPaid';
import { MarkManyBookingsPaidMessage } from '@/contexts/billing/application/mark-many-bookings-paid/MarkManyBookingsPaidMessage';
import { MarkManyBookingsUnpaid } from '@/contexts/billing/application/mark-many-bookings-unpaid/MarkManyBookingsUnpaid';
import { MarkManyBookingsUnpaidMessage } from '@/contexts/billing/application/mark-many-bookings-unpaid/MarkManyBookingsUnpaidMessage';
import { BookingPayment } from '@/contexts/billing/domain/BookingPayment';
import { BookingNotFoundError } from '@/contexts/billing/domain/errors/BookingNotFoundError';
import { InvalidPaymentMethodError } from '@/contexts/billing/domain/errors/InvalidPaymentMethodError';
import { BookingPaymentRepository } from '@/contexts/billing/domain/repositories/BookingPaymentRepository';

class InMemoryBookingPayments implements BookingPaymentRepository {
  private readonly payments = new Map<string, BookingPayment>();

  public constructor(ids: string[], status: 'pendiente' | 'pagada' = 'pendiente') {
    for (const id of ids) {
      this.payments.set(
        id,
        BookingPayment.fromPrimitives({
          bookingId: id,
          paymentStatus: status,
          paymentMethod: status === 'pagada' ? 'efectivo' : null,
          paidAt: status === 'pagada' ? '2026-06-01T12:00:00.000Z' : null,
        }),
      );
    }
  }

  public async find(bookingId: string): Promise<BookingPayment | null> {
    return this.payments.get(bookingId) ?? null;
  }

  public async save(payment: BookingPayment): Promise<void> {
    this.payments.set(payment.toPrimitives().bookingId, payment);
  }

  public primitivesOf(bookingId: string) {
    return this.payments.get(bookingId)?.toPrimitives();
  }
}

describe('MarkManyBookingsPaid (v2-spec §6.14: paquetes 4/10)', () => {
  it('marca todas las seleccionadas como pagadas con el mismo método y fecha', async () => {
    const repo = new InMemoryBookingPayments(['b-1', 'b-2', 'b-3']);
    const paidAt = '2026-06-11T12:00:00.000Z';
    await new MarkManyBookingsPaid(repo).markPaid(
      new MarkManyBookingsPaidMessage({ bookingIds: ['b-1', 'b-2', 'b-3'], method: 'tarjeta', paidAt }),
    );
    for (const id of ['b-1', 'b-2', 'b-3']) {
      expect(repo.primitivesOf(id)).toEqual({
        bookingId: id,
        paymentStatus: 'pagada',
        paymentMethod: 'tarjeta',
        paidAt,
      });
    }
  });

  it('lanza BookingNotFoundError si alguna sesión no existe (o es de otro owner)', async () => {
    const repo = new InMemoryBookingPayments(['b-1']);
    await expect(
      new MarkManyBookingsPaid(repo).markPaid(
        new MarkManyBookingsPaidMessage({ bookingIds: ['b-1', 'b-ajena'], method: 'efectivo' }),
      ),
    ).rejects.toThrow(BookingNotFoundError);
  });
});

describe('MarkManyBookingsUnpaid', () => {
  it('devuelve las seleccionadas a pendiente limpiando método y fecha', async () => {
    const repo = new InMemoryBookingPayments(['b-1', 'b-2'], 'pagada');
    await new MarkManyBookingsUnpaid(repo).markUnpaid(
      new MarkManyBookingsUnpaidMessage({ bookingIds: ['b-1', 'b-2'] }),
    );
    for (const id of ['b-1', 'b-2']) {
      expect(repo.primitivesOf(id)).toEqual({
        bookingId: id,
        paymentStatus: 'pendiente',
        paymentMethod: null,
        paidAt: null,
      });
    }
  });
});

describe('mensajes de selección múltiple', () => {
  it('deduplica ids y descarta vacíos', () => {
    const message = new MarkManyBookingsPaidMessage({
      bookingIds: ['b-1', ' b-1 ', '', 'b-2'],
      method: 'transferencia',
    });
    expect(message.bookingIds()).toEqual(['b-1', 'b-2']);
  });

  it('exige al menos una sesión seleccionada', () => {
    expect(() => new MarkManyBookingsPaidMessage({ bookingIds: ['', '  '], method: 'efectivo' })).toThrow();
    expect(() => new MarkManyBookingsUnpaidMessage({ bookingIds: [] })).toThrow();
  });

  it('rechaza métodos de pago desconocidos', () => {
    expect(
      () => new MarkManyBookingsPaidMessage({ bookingIds: ['b-1'], method: 'criptomoneda' }),
    ).toThrow(InvalidPaymentMethodError);
  });
});
