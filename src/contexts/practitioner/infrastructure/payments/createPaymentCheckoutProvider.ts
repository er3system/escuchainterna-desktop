import type { PaymentCheckoutProvider } from '../../domain/PaymentCheckoutProvider';
import type { PaymentGatewaySettings } from '../../domain/paymentGateways';
import { PaymentCheckoutUrl } from '../../domain/value-objects/PaymentCheckoutUrl';
import { LocalSimulatedCheckout } from './LocalSimulatedCheckout';
import { MercadoPagoCheckout } from './MercadoPagoCheckout';
import { PayPalCheckout } from './PayPalCheckout';
import { StripeCheckout } from './StripeCheckout';

/**
 * Selecciona un checkout externo cuando existe un enlace manual HTTPS válido.
 * Las credenciales/OAuth que aún requieren API y webhook conservan el modo
 * local simulado hasta que sus adaptadores asíncronos estén implementados.
 */
export function createPaymentCheckoutProvider(settings: PaymentGatewaySettings): PaymentCheckoutProvider {
  if (
    settings.provider === 'stripe' &&
    PaymentCheckoutUrl.isValid('stripe', settings.stripePaymentLink)
  ) {
    return new StripeCheckout();
  }
  if (
    settings.provider === 'mercado_pago' &&
    PaymentCheckoutUrl.isValid('mercado_pago', settings.checkoutLink)
  ) {
    return new MercadoPagoCheckout();
  }
  if (
    settings.provider === 'paypal' &&
    PaymentCheckoutUrl.isValid('paypal', settings.paypalMeLink)
  ) {
    return new PayPalCheckout();
  }
  return new LocalSimulatedCheckout();
}

/** Fuente única para impedir que una simulación acredite dinero en producción. */
export function paymentCheckoutIsSimulated(settings: PaymentGatewaySettings): boolean {
  return createPaymentCheckoutProvider(settings).mode() === 'local_simulation';
}
