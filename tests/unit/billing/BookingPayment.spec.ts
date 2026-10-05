import { describe, expect, it } from 'vitest';
import { BookingPayment } from '@/contexts/billing/domain/BookingPayment';
import { PaymentMethod } from '@/contexts/billing/domain/value-objects/PaymentMethod';
import { MarkBookingPaidMessage } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaidMessage';
import { InvalidPaymentMethodError } from '@/contexts/billing/domain/errors/InvalidPaymentMethodError';

describe('BookingPayment', () => {
  const pending = () =>
    BookingPayment.fromPrimitives({
      bookingId: 'b-1',
      paymentStatus: 'pendiente',
      paymentMethod: null,
      paidAt: null,
    });

  it('marks a booking as paid stamping method and paid_at', () => {
    const payment = pending();
    const paidAt = new Date('2026-06-10T18:00:00.000Z');
    payment.markPaid(new PaymentMethod('efectivo'), paidAt);
    expect(payment.isPaid()).toBe(true);
    expect(payment.toPrimitives()).toEqual({
      bookingId: 'b-1',
      paymentStatus: 'pagada',
      paymentMethod: 'efectivo',
      paidAt: '2026-06-10T18:00:00.000Z',
    });
  });

  it('reverts to pending clearing method and stamp', () => {
    const payment = pending();
    payment.markPaid(new PaymentMethod('stripe'), new Date());
    payment.markUnpaid();
    expect(payment.isPaid()).toBe(false);
    expect(payment.toPrimitives().paymentMethod).toBeNull();
    expect(payment.toPrimitives().paidAt).toBeNull();
  });
});

describe('MarkBookingPaidMessage', () => {
  it('rejects unknown payment methods with a domain error', () => {
    expect(() => new MarkBookingPaidMessage({ bookingId: 'b-1', method: 'bitcoin' })).toThrow(
      InvalidPaymentMethodError,
    );
  });

  it('defaults paidAt to now when missing or invalid', () => {
    const before = Date.now();
    const message = new MarkBookingPaidMessage({ bookingId: 'b-1', method: 'tarjeta', paidAt: 'no-fecha' });
    expect(message.paidAt().getTime()).toBeGreaterThanOrEqual(before);
    expect(message.method().valueOf()).toBe('tarjeta');
  });
});
