import { describe, it, expect } from 'vitest';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import { CancellationWindowClosedError } from '@/contexts/scheduling/domain/errors/CancellationWindowClosedError';
import { InvalidBookingTransitionError } from '@/contexts/scheduling/domain/errors/InvalidBookingTransitionError';
import { SessionCancelledEvent } from '@/contexts/scheduling/domain/events/SessionCancelledEvent';
import { SessionRescheduledEvent } from '@/contexts/scheduling/domain/events/SessionRescheduledEvent';
import { SessionBookedEvent } from '@/contexts/scheduling/domain/events/SessionBookedEvent';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-06-11T10:00:00.000Z');

function buildBooking(hoursFromNow: number): Booking {
  const startAt = new Date(now.getTime() + hoursFromNow * HOUR_MS);
  return Booking.create({
    id: 'reserva-1',
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAt,
    endAt: new Date(startAt.getTime() + HOUR_MS),
    price: 500,
    currency: 'MXN',
    modality: 'presencial',
    meetUrl: null,
    recurrenceId: null,
    bookedBy: 'profesional',
  });
}

describe('Booking.create', () => {
  it('registra el evento de sesión agendada', () => {
    const booking = buildBooking(48);
    const events = booking.pullDomainEvents();
    expect(events.some((event) => event instanceof SessionBookedEvent)).toBe(true);
  });

  it('guarda la moneda del cobro y la conserva en sus primitivos', () => {
    const booking = buildBooking(48);
    expect(booking.toPrimitives().currency).toBe('MXN');
  });

  it('rechaza crear una sesión sin moneda', () => {
    const startAt = new Date(now.getTime() + 48 * HOUR_MS);
    expect(() =>
      Booking.create({
        id: 'reserva-x',
        agendaId: 'agenda-1',
        patientId: 'paciente-1',
        startAt,
        endAt: new Date(startAt.getTime() + HOUR_MS),
        price: 500,
        currency: '  ',
        modality: 'presencial',
        meetUrl: null,
        recurrenceId: null,
        bookedBy: 'profesional',
      }),
    ).toThrow();
  });
});

describe('Booking.cancel', () => {
  it('rechaza la cancelación del paciente dentro de la ventana cerrada', () => {
    const booking = buildBooking(10); // faltan 10 h, mínimo 24 h
    expect(() => booking.cancel('paciente', 24, now)).toThrow(CancellationWindowClosedError);
  });

  it('permite la cancelación del paciente fuera de la ventana', () => {
    const booking = buildBooking(48);
    booking.cancel('paciente', 24, now);
    expect(booking.toPrimitives().status).toBe('cancelada');
    const events = booking.pullDomainEvents();
    expect(events.some((event) => event instanceof SessionCancelledEvent)).toBe(true);
  });

  it('permite al profesional cancelar aunque la ventana esté cerrada', () => {
    const booking = buildBooking(1);
    booking.cancel('profesional', 24, now);
    expect(booking.toPrimitives().status).toBe('cancelada');
  });

  it('rechaza cancelar una sesión ya cancelada', () => {
    const booking = buildBooking(48);
    booking.cancel('profesional', 24, now);
    expect(() => booking.cancel('profesional', 24, now)).toThrow(InvalidBookingTransitionError);
  });
});

describe('Booking.reschedule', () => {
  it('incrementa el contador, registra el evento y reinicia la confirmación', () => {
    const booking = buildBooking(48);
    booking.confirm();
    const newStart = new Date(now.getTime() + 72 * HOUR_MS);
    const newEnd = new Date(newStart.getTime() + HOUR_MS);
    booking.reschedule(newStart, newEnd, 'profesional', 24, now);
    const primitives = booking.toPrimitives();
    expect(primitives.rescheduleCount).toBe(1);
    expect(primitives.status).toBe('agendada');
    expect(primitives.startAt).toBe(newStart.toISOString());
    const events = booking.pullDomainEvents();
    expect(events.some((event) => event instanceof SessionRescheduledEvent)).toBe(true);
  });

  it('rechaza el reagendado del paciente dentro de la ventana cerrada', () => {
    const booking = buildBooking(5);
    const newStart = new Date(now.getTime() + 72 * HOUR_MS);
    const newEnd = new Date(newStart.getTime() + HOUR_MS);
    expect(() => booking.reschedule(newStart, newEnd, 'paciente', 24, now)).toThrow(
      CancellationWindowClosedError,
    );
  });
});

describe('Booking.markAsPaid', () => {
  it('marca la sesión como pagada con método y fecha', () => {
    const booking = buildBooking(48);
    booking.markAsPaid('transferencia', now);
    const primitives = booking.toPrimitives();
    expect(primitives.paymentStatus).toBe('pagada');
    expect(primitives.paymentMethod).toBe('transferencia');
    expect(primitives.paidAt).toBe(now.toISOString());
  });
});
