import type {
  CheckoutBooking,
  PaymentCheckoutMode,
  PaymentCheckoutProvider,
} from '../../domain/PaymentCheckoutProvider';
import type { PaymentGatewaySettings } from '../../domain/paymentGateways';
import { PaymentCheckoutUrl } from '../../domain/value-objects/PaymentCheckoutUrl';

/**
 * Adaptador de Link de Pago de Mercado Pago. El checkout API dinámico y su
 * webhook siguen pendientes; este camino externo requiere conciliación manual.
 *
 * TODO(producción) — vinculación de cuenta (el camino "con un clic" que hoy
 * simula /conectar/mercado_pago): **OAuth de Mercado Pago (marketplace)**.
 *  a. Redirigir al profesional a
 *     https://auth.mercadopago.com/authorization?client_id=MERCADOPAGO_APP_ID
 *       &response_type=code&platform_id=mp&redirect_uri=<APP_BASE_URL>/conectar/mercado_pago/callback
 *  b. Intercambiar el authorization code:
 *     POST https://api.mercadopago.com/oauth/token
 *       { grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri }
 *     → access_token DEL VENDEDOR + refresh_token + user_id (se persiste
 *     user_id como config.linkedAccountId; el access_token del vendedor
 *     sustituye al manual config.accessToken).
 *
 * TODO(producción) — checkout por sesión: Checkout Pro (preferencias).
 *  1. El link manual ya se devuelve directamente: Mercado Pago cobra el monto
 *     fijo definido en ese link.
 *  2. Pendiente, con access_token (manual o obtenido por OAuth):
 *     POST https://api.mercadopago.com/checkout/preferences
 *       Authorization: Bearer <accessToken del vendedor>
 *       body: {
 *         items: [{ title: booking.concept, quantity: 1,
 *                   unit_price: booking.amount, currency_id: booking.currency }],
 *         external_reference: booking.bookingId,
 *         marketplace_fee: <retención de la organización, si aplica>,
 *         back_urls: { success|pending|failure: `${APP_BASE_URL}/sesion/${booking.bookingId}` },
 *         auto_return: 'approved',
 *       }
 *     y devolver el `init_point` de la respuesta (URL del checkout).
 *     - LIMITACIÓN de moneda: Mercado Pago cobra en la MONEDA LOCAL de la
 *       cuenta del vendedor (config.country); currency_id debe coincidir.
 *       No hay multi-moneda nativa: si el paciente paga desde otro país, la
 *       conversión la hace su banco/tarjeta (por eso el selector "Pagar en"
 *       del checkout simulado solo muestra una conversión aproximada).
 *  3. La confirmación del pago NO debe depender del navegador del paciente:
 *     registrar un webhook (notification_url, topic `payment`) que al recibir
 *     un pago aprobado llame al caso de uso de billing MarkBookingPaid con
 *     method 'mercado_pago'.
 *
 * Variables de entorno: MERCADOPAGO_APP_ID, MERCADOPAGO_CLIENT_SECRET
 * (credenciales de la app marketplace; los tokens de cada vendedor se
 * obtienen por OAuth y viven en su config_json).
 *
 * Nota: createCheckoutUrl del puerto es síncrono; al implementar este
 * adaptador la llamada HTTP obligará a evolucionar el puerto a Promise<string>.
 */
export class MercadoPagoCheckout implements PaymentCheckoutProvider {
  public mode(): PaymentCheckoutMode {
    return 'external_manual';
  }

  public createCheckoutUrl(booking: CheckoutBooking, config: PaymentGatewaySettings): string {
    return PaymentCheckoutUrl.create('mercado_pago', config.checkoutLink).forPayment(
      booking.amount,
      booking.currency,
    );
  }
}
