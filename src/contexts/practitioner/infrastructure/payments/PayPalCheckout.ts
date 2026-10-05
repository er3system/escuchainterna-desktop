import type {
  CheckoutBooking,
  PaymentCheckoutMode,
  PaymentCheckoutProvider,
} from '../../domain/PaymentCheckoutProvider';
import type { PaymentGatewaySettings } from '../../domain/paymentGateways';
import { PaymentCheckoutUrl } from '../../domain/value-objects/PaymentCheckoutUrl';

/**
 * Adaptador de PayPal.me. Orders v2 y su webhook siguen pendientes; este
 * camino externo requiere conciliación manual.
 *
 * TODO(producción) — vinculación de cuenta (el camino "con un clic" que hoy
 * simula /conectar/paypal): **PayPal Partner Referrals API** (Commerce
 * Platform).
 *  a. Con las credenciales de PLATAFORMA:
 *     POST https://api-m.paypal.com/v2/customer/partner-referrals
 *       body: { operations: [{ operation: 'API_INTEGRATION', … }],
 *               products: ['EXPRESS_CHECKOUT'],
 *               partner_config_override: {
 *                 return_url: `${APP_BASE_URL}/configuracion/integraciones` },
 *               legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }] }
 *     y redirigir al profesional al link `rel === 'action_url'` (la pantalla
 *     de autorización es de PayPal: crea o conecta su cuenta Business).
 *  b. Al volver, PayPal entrega el merchantIdInPayPal del profesional
 *     (se persiste como config.linkedAccountId).
 *
 * TODO(producción) — checkout por sesión: Orders API v2.
 *  1. El enlace PayPal.me ya se devuelve como
 *     `https://paypal.me/<usuario>/<monto><moneda>`.
 *  2. Pendiente, con cuenta vinculada (o client_id manual):
 *     a. POST https://api-m.paypal.com/v1/oauth2/token (client_credentials
 *        de plataforma) para obtener el access token.
 *     b. POST https://api-m.paypal.com/v2/checkout/orders
 *        body: { intent: 'CAPTURE',
 *                purchase_units: [{ reference_id: booking.bookingId,
 *                  description: booking.concept,
 *                  amount: { currency_code: booking.currency,
 *                            value: booking.amount.toFixed(2) },
 *                  payee: { merchant_id: config.linkedAccountId }, // el dinero
 *                  // entra DIRECTO a la cuenta del profesional
 *                  payment_instruction: { platform_fees: [ … ] } }], // retención org
 *                application_context: {
 *                  return_url: `${APP_BASE_URL}/sesion/${booking.bookingId}` } }
 *        y devolver el link `rel === 'approve'` de la respuesta.
 *     - Multi-moneda NATIVA: PayPal acepta currency_code distinto de la
 *       moneda del vendedor y convierte al liquidar; el paciente puede pagar
 *       en la suya (el selector "Pagar en" del checkout simulado imita esto).
 *  3. Confirmar el pago en el return/webhook (CHECKOUT.ORDER.APPROVED →
 *     capture) y entonces llamar al caso de uso de billing MarkBookingPaid
 *     con method 'paypal'.
 *
 * Variables de entorno: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (de la
 * plataforma como partner; el merchant id de cada profesional vive en su
 * config_json tras la vinculación).
 *
 * Nota: createCheckoutUrl del puerto es síncrono; al implementar este
 * adaptador la llamada HTTP obligará a evolucionar el puerto a Promise<string>.
 */
export class PayPalCheckout implements PaymentCheckoutProvider {
  public mode(): PaymentCheckoutMode {
    return 'external_manual';
  }

  public createCheckoutUrl(booking: CheckoutBooking, config: PaymentGatewaySettings): string {
    return PaymentCheckoutUrl.create('paypal', config.paypalMeLink).forPayment(
      booking.amount,
      booking.currency,
    );
  }
}
