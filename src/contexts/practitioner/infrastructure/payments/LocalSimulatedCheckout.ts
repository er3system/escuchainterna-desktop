import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import type {
  CheckoutBooking,
  PaymentCheckoutMode,
  PaymentCheckoutProvider,
} from '../../domain/PaymentCheckoutProvider';
import type { PaymentGatewaySettings } from '../../domain/paymentGateways';

/**
 * Checkout simulado para el modo local: la "URL de pago" apunta a la página
 * pública de la sesión (/sesion/<bookingId>) con el checkout de la pasarela
 * abierto (?checkout=mercado_pago|paypal). Al confirmar ahí, la sesión se
 * marca como pagada vía el caso de uso de billing MarkBookingPaid.
 *
 * En producción este adaptador se sustituye por MercadoPagoCheckout /
 * PayPalCheckout (ver esqueletos en esta misma carpeta).
 */
export class LocalSimulatedCheckout implements PaymentCheckoutProvider {
  public mode(): PaymentCheckoutMode {
    return 'local_simulation';
  }

  public createCheckoutUrl(booking: CheckoutBooking, config: PaymentGatewaySettings): string {
    return `${getAppBaseUrl()}/sesion/${booking.bookingId}?checkout=${config.provider}`;
  }
}
