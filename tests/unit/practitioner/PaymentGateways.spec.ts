import { afterEach, describe, expect, it } from 'vitest';
import {
  PAYMENT_GATEWAY_PROVIDERS,
  SIMULATED_LINKED_ACCOUNT_PREFIX,
  isGatewayActiveForPatients,
  isPaymentGatewayProvider,
  newSimulatedLinkedAccountId,
  parsePaymentGatewaySettings,
} from '@/contexts/practitioner/domain/paymentGateways';
import { LocalSimulatedCheckout } from '@/contexts/practitioner/infrastructure/payments/LocalSimulatedCheckout';
import {
  createPaymentCheckoutProvider,
  paymentCheckoutIsSimulated,
} from '@/contexts/practitioner/infrastructure/payments/createPaymentCheckoutProvider';
import { InvalidPaymentCheckoutUrlError } from '@/contexts/practitioner/domain/errors/InvalidPaymentCheckoutUrlError';
import { PaymentCheckoutUrl } from '@/contexts/practitioner/domain/value-objects/PaymentCheckoutUrl';
import { PaymentMethod } from '@/contexts/billing/domain/value-objects/PaymentMethod';
import { MarkBookingPaidMessage } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaidMessage';

describe('paymentGateways (dominio puro)', () => {
  it('reconoce stripe, mercado_pago y paypal como pasarelas', () => {
    expect(isPaymentGatewayProvider('stripe')).toBe(true);
    expect(isPaymentGatewayProvider('mercado_pago')).toBe(true);
    expect(isPaymentGatewayProvider('paypal')).toBe(true);
    expect(isPaymentGatewayProvider('google_calendar')).toBe(false);
    expect(isPaymentGatewayProvider('')).toBe(false);
  });

  it('Stripe queda configurado con secret key O Payment Link', () => {
    expect(parsePaymentGatewaySettings('stripe', { secret_key: 'sk_live_1' }).configured).toBe(true);
    expect(
      parsePaymentGatewaySettings('stripe', { payment_link: 'https://buy.stripe.com/abc' }).configured,
    ).toBe(true);
    expect(parsePaymentGatewaySettings('stripe', {}).configured).toBe(false);
  });

  it('Mercado Pago queda configurado con access token O link de checkout', () => {
    const withToken = parsePaymentGatewaySettings('mercado_pago', {
      access_token: 'APP_USR-123',
      country: 'MX',
    });
    expect(withToken.configured).toBe(true);

    const withLink = parsePaymentGatewaySettings('mercado_pago', {
      checkout_link: 'https://mpago.la/abc',
    });
    expect(withLink.configured).toBe(true);

    const empty = parsePaymentGatewaySettings('mercado_pago', { country: 'AR' });
    expect(empty.configured).toBe(false);
  });

  it('PayPal queda configurado con client id O enlace PayPal.me', () => {
    expect(parsePaymentGatewaySettings('paypal', { client_id: 'AeA1' }).configured).toBe(true);
    expect(
      parsePaymentGatewaySettings('paypal', { paypal_me: 'https://paypal.me/dra' }).configured,
    ).toBe(true);
    expect(parsePaymentGatewaySettings('paypal', {}).configured).toBe(false);
  });

  it('rechaza enlaces externos que no pertenecen a la pasarela', () => {
    expect(
      parsePaymentGatewaySettings('mercado_pago', { checkout_link: 'https://example.com/cobrar' }).configured,
    ).toBe(false);
    expect(
      parsePaymentGatewaySettings('paypal', { paypal_me: 'javascript:alert(1)' }).configured,
    ).toBe(false);
    expect(
      parsePaymentGatewaySettings('paypal', { paypal_me: 'https://cobros.paypal.me/dra' }).configured,
    ).toBe(false);
    expect(() => PaymentCheckoutUrl.create('stripe', 'https://evil.example/checkout')).toThrow(
      InvalidPaymentCheckoutUrlError,
    );
  });

  it('una cuenta vinculada por OAuth configura la pasarela SIN credenciales manuales', () => {
    for (const provider of PAYMENT_GATEWAY_PROVIDERS) {
      const linked = parsePaymentGatewaySettings(provider, {
        linked_account_id: `${SIMULATED_LINKED_ACCOUNT_PREFIX[provider]}abc123`,
        linked_at: '2026-06-12T10:00:00.000Z',
        link_method: 'oauth',
      });
      expect(linked.configured).toBe(true);
      expect(linked.linkedAccountId).toContain(SIMULATED_LINKED_ACCOUNT_PREFIX[provider]);
      expect(linked.linkMethod).toBe('oauth');
    }
  });

  it('el botón de pago exige configuración (vinculada o manual) Y el toggle activo', () => {
    const offToggle = parsePaymentGatewaySettings('paypal', {
      client_id: 'AeA1',
      show_payment_button: 'false',
    });
    expect(isGatewayActiveForPatients(offToggle)).toBe(false);

    const active = parsePaymentGatewaySettings('paypal', {
      client_id: 'AeA1',
      show_payment_button: 'true',
    });
    expect(isGatewayActiveForPatients(active)).toBe(true);

    const onlyToggle = parsePaymentGatewaySettings('mercado_pago', { show_payment_button: 'true' });
    expect(isGatewayActiveForPatients(onlyToggle)).toBe(false);

    const linkedWithToggle = parsePaymentGatewaySettings('stripe', {
      linked_account_id: 'acct_demo_x1',
      link_method: 'oauth',
      show_payment_button: 'true',
    });
    expect(isGatewayActiveForPatients(linkedWithToggle)).toBe(true);

    const linkedWithoutToggle = parsePaymentGatewaySettings('stripe', {
      linked_account_id: 'acct_demo_x1',
      link_method: 'oauth',
    });
    expect(isGatewayActiveForPatients(linkedWithoutToggle)).toBe(false);
  });

  it('genera ids de cuenta vinculada simulada con el prefijo del proveedor', () => {
    expect(newSimulatedLinkedAccountId('stripe')).toMatch(/^acct_demo_[a-z0-9]{6}$/);
    expect(newSimulatedLinkedAccountId('mercado_pago')).toMatch(/^mp_usr_demo_[a-z0-9]{6}$/);
    expect(newSimulatedLinkedAccountId('paypal')).toMatch(/^paypal_merchant_demo_[a-z0-9]{6}$/);
  });
});

describe('LocalSimulatedCheckout (adaptador local del puerto)', () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it('apunta a la página pública /sesion/<bookingId> con el checkout abierto', () => {
    const settings = parsePaymentGatewaySettings('mercado_pago', {
      access_token: 'APP_USR-123',
      show_payment_button: 'true',
    });
    const url = new LocalSimulatedCheckout().createCheckoutUrl(
      { bookingId: 'b-uuid-1', amount: 850, currency: 'MXN', concept: 'Sesión con Dra. Pérez' },
      settings,
    );
    expect(url).toBe('http://localhost:3000/sesion/b-uuid-1?checkout=mercado_pago');
  });

  it('genera el checkout simulado de Stripe para una cuenta vinculada por OAuth', () => {
    const settings = parsePaymentGatewaySettings('stripe', {
      linked_account_id: 'acct_demo_x1',
      link_method: 'oauth',
      show_payment_button: 'true',
    });
    const url = createPaymentCheckoutProvider(settings).createCheckoutUrl(
      { bookingId: 'b-uuid-3', amount: 850, currency: 'MXN', concept: 'Sesión' },
      settings,
    );
    expect(url).toBe('http://localhost:3000/sesion/b-uuid-3?checkout=stripe');
  });

  it('respeta APP_BASE_URL configurada por entorno para credenciales sin link manual', () => {
    process.env.APP_BASE_URL = 'https://app.escuchainterna.com/';
    const settings = parsePaymentGatewaySettings('paypal', {
      client_id: 'client-demo',
      show_payment_button: 'true',
    });
    const url = createPaymentCheckoutProvider(settings).createCheckoutUrl(
      { bookingId: 'b-uuid-2', amount: 50, currency: 'USD', concept: 'Sesión' },
      settings,
    );
    expect(url).toBe('https://app.escuchainterna.com/sesion/b-uuid-2?checkout=paypal');
    expect(paymentCheckoutIsSimulated(settings)).toBe(true);
  });

  it('genera un cobro externo PayPal.me con monto y moneda', () => {
    const settings = parsePaymentGatewaySettings('paypal', {
      paypal_me: 'https://paypal.me/dra',
      show_payment_button: 'true',
    });
    const checkout = createPaymentCheckoutProvider(settings);
    expect(checkout.mode()).toBe('external_manual');
    expect(
      checkout.createCheckoutUrl(
        { bookingId: 'b-uuid-4', amount: 850.5, currency: 'MXN', concept: 'Sesión' },
        settings,
      ),
    ).toBe('https://paypal.me/dra/850.5MXN');
    expect(paymentCheckoutIsSimulated(settings)).toBe(false);
  });

  it('abre el Link de Pago configurado para Mercado Pago sin alterar su precio', () => {
    const settings = parsePaymentGatewaySettings('mercado_pago', {
      checkout_link: 'https://mpago.la/abc123',
      show_payment_button: 'true',
    });
    const checkout = createPaymentCheckoutProvider(settings);
    expect(checkout.mode()).toBe('external_manual');
    expect(
      checkout.createCheckoutUrl(
        { bookingId: 'b-uuid-5', amount: 850, currency: 'MXN', concept: 'Sesión' },
        settings,
      ),
    ).toBe('https://mpago.la/abc123');
  });
});

describe('métodos de pago de pasarelas en billing', () => {
  it('MarkBookingPaid acepta stripe, mercado_pago y paypal como método', () => {
    expect(PaymentMethod.isValid('stripe')).toBe(true);
    expect(PaymentMethod.isValid('mercado_pago')).toBe(true);
    expect(PaymentMethod.isValid('paypal')).toBe(true);
    const message = new MarkBookingPaidMessage({ bookingId: 'b-1', method: 'mercado_pago' });
    expect(message.method().valueOf()).toBe('mercado_pago');
    expect(PaymentMethod.labelFor('paypal')).toBe('PayPal');
    expect(PaymentMethod.labelFor('mercado_pago')).toBe('Mercado Pago');
    expect(PaymentMethod.labelFor('stripe')).toBe('Stripe');
  });
});
