import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaPaymentOverride, PaymentDefaults } from '@/contexts/scheduling/domain/Agenda';
import { CreateAgendaMessage } from '@/contexts/scheduling/application/create-agenda/CreateAgendaMessage';
import { InvalidAgendaConfigurationError } from '@/contexts/scheduling/domain/errors/InvalidAgendaConfigurationError';

const GLOBAL_DEFAULTS: PaymentDefaults = {
  price: 500,
  paymentMode: 'manual',
  showPrice: true,
  currency: 'COP',
};

function buildAgenda(paymentOverride: AgendaPaymentOverride | null): Agenda {
  return Agenda.create('agenda-1', {
    name: 'Sesión individual',
    color: '#2180DB',
    slug: 'sesion-individual',
    durationMinutes: 60,
    slotIntervalMinutes: 60,
    minBookingHours: 8,
    bufferMinutes: 0,
    availabilityOverride: null,
    paymentOverride,
    locationOverride: null,
  });
}

describe('Agenda.effectiveCurrency', () => {
  it('usa la moneda del override de pago cuando la agenda define una propia', () => {
    const agenda = buildAgenda({
      price: 80,
      paymentMode: 'manual',
      showPrice: true,
      showStripeLink: false,
      currency: 'USD',
    });
    expect(agenda.effectiveCurrency('COP')).toBe('USD');
  });

  it("cae a la moneda del perfil cuando el override la deja vacía ('' = perfil)", () => {
    const agenda = buildAgenda({
      price: 80,
      paymentMode: 'manual',
      showPrice: true,
      showStripeLink: false,
      currency: '',
    });
    expect(agenda.effectiveCurrency('COP')).toBe('COP');
  });

  it('cae a la moneda del perfil cuando no hay override de pago', () => {
    const agenda = buildAgenda(null);
    expect(agenda.effectiveCurrency('COP')).toBe('COP');
  });
});

describe('Agenda.effectivePrice (moneda)', () => {
  it('expone la moneda del override junto con su precio', () => {
    const agenda = buildAgenda({
      price: 80,
      paymentMode: 'manual',
      showPrice: true,
      showStripeLink: false,
      currency: 'USD',
    });
    const payment = agenda.effectivePrice(GLOBAL_DEFAULTS);
    expect(payment.price).toBe(80);
    expect(payment.currency).toBe('USD');
  });

  it('expone la moneda del perfil cuando el override no define una', () => {
    const agenda = buildAgenda({
      price: 80,
      paymentMode: 'manual',
      showPrice: true,
      showStripeLink: false,
      currency: '',
    });
    expect(agenda.effectivePrice(GLOBAL_DEFAULTS).currency).toBe('COP');
  });

  it('expone la moneda del perfil cuando la agenda usa el pago global', () => {
    const agenda = buildAgenda(null);
    const payment = agenda.effectivePrice(GLOBAL_DEFAULTS);
    expect(payment.price).toBe(500);
    expect(payment.currency).toBe('COP');
  });

  it('impone precio cero y oculta el checkout cuando la membresía deshabilita pagos', () => {
    const agenda = buildAgenda({
      price: 999,
      paymentMode: 'requerido',
      showPrice: true,
      showStripeLink: true,
      currency: 'USD',
    });

    expect(agenda.effectivePrice({ ...GLOBAL_DEFAULTS, paymentsEnabled: false })).toEqual({
      price: 0,
      paymentMode: 'manual',
      showPrice: false,
      showPaymentLink: false,
      currency: 'COP',
    });
  });

  it('conserva la moneda del override en sus primitivos (ida y vuelta)', () => {
    const agenda = buildAgenda({
      price: 80,
      paymentMode: 'manual',
      showPrice: true,
      showStripeLink: false,
      currency: 'USD',
    });
    const rehydrated = Agenda.fromPrimitives(agenda.toPrimitives());
    expect(rehydrated.effectiveCurrency('COP')).toBe('USD');
  });
});

describe('CreateAgendaMessage (moneda del override)', () => {
  it('normaliza el código a mayúsculas', () => {
    const message = new CreateAgendaMessage({
      name: 'Sesión',
      paymentOverride: { price: 80, paymentMode: 'manual', showPrice: true, currency: 'usd' },
    });
    expect(message.agendaConfiguration().paymentOverride?.currency).toBe('USD');
  });

  it("acepta '' como «usar la moneda del perfil»", () => {
    const message = new CreateAgendaMessage({
      name: 'Sesión',
      paymentOverride: { price: 80, paymentMode: 'manual', showPrice: true, currency: '' },
    });
    expect(message.agendaConfiguration().paymentOverride?.currency).toBe('');
  });

  it('rechaza monedas fuera del catálogo soportado', () => {
    expect(
      () =>
        new CreateAgendaMessage({
          name: 'Sesión',
          paymentOverride: { price: 80, paymentMode: 'manual', showPrice: true, currency: 'XXX' },
        }),
    ).toThrow(InvalidAgendaConfigurationError);
  });
});
