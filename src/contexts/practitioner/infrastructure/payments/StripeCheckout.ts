import type {
  CheckoutBooking,
  PaymentCheckoutMode,
  PaymentCheckoutProvider,
} from '../../domain/PaymentCheckoutProvider';
import type { PaymentGatewaySettings } from '../../domain/paymentGateways';
import { PaymentCheckoutUrl } from '../../domain/value-objects/PaymentCheckoutUrl';

/**
 * Adaptador de Stripe Payment Links. Connect y su webhook siguen pendientes;
 * este camino externo requiere conciliación manual.
 *
 * TODO(producción) — vinculación de cuenta (el camino "con un clic" que hoy
 * simula /conectar/stripe): **Stripe Connect**.
 *  a. Crear la cuenta conectada del profesional:
 *     POST /v1/accounts { type: 'standard' } → acct_… (se persiste como
 *     config.linkedAccountId, igual que hoy guarda el id simulado).
 *  b. Onboarding con Account Links:
 *     POST /v1/account_links { account: acct_…, type: 'account_onboarding',
 *       refresh_url, return_url: `${APP_BASE_URL}/configuracion/integraciones` }
 *     y redirigir al profesional a la URL devuelta (la pantalla de
 *     autorización es de Stripe; al volver, marcar la pasarela vinculada).
 *     Alternativa equivalente: OAuth de Connect
 *     (https://connect.stripe.com/oauth/authorize?client_id=STRIPE_CONNECT_CLIENT_ID…
 *     → code → POST /oauth/token → stripe_user_id).
 *
 * TODO(producción) — checkout por sesión:
 *  1. El Payment Link manual ya se devuelve directamente.
 *  2. Pendiente, con cuenta vinculada (config.linkedAccountId):
 *     POST /v1/checkout/sessions con la clave DE PLATAFORMA y
 *       Stripe-Account: <linkedAccountId>  (direct charge: el dinero entra
 *       a la cuenta del profesional, nunca a la plataforma)
 *       body: { mode: 'payment',
 *               line_items: [{ quantity: 1, price_data: {
 *                 currency: booking.currency, unit_amount: booking.amount*100,
 *                 product_data: { name: booking.concept } } }],
 *               client_reference_id: booking.bookingId,
 *               payment_intent_data: { application_fee_amount: <retención> },
 *               success_url/cancel_url: `${APP_BASE_URL}/sesion/${booking.bookingId}` }
 *     y devolver `url` de la respuesta.
 *     - application_fee_amount: retención de la organización
 *       (retention_percent de organization_memberships) como comisión de
 *       plataforma; 0 si el profesional es independiente.
 *     - **Adaptive Pricing**: activado en el Dashboard, Stripe muestra al
 *       paciente el monto convertido a SU moneda local automáticamente
 *       (el selector "Pagar en" del checkout simulado imita esto); el
 *       profesional sigue liquidando en su moneda.
 *  3. La confirmación NO depende del navegador del paciente: webhook
 *     `checkout.session.completed` → MarkBookingPaid con method 'stripe'.
 *
 * Variables de entorno: STRIPE_SECRET_KEY (plataforma),
 * STRIPE_CONNECT_CLIENT_ID (OAuth), STRIPE_WEBHOOK_SECRET.
 *
 * Nota: createCheckoutUrl del puerto es síncrono; al implementar este
 * adaptador la llamada HTTP obligará a evolucionar el puerto a Promise<string>.
 */
export class StripeCheckout implements PaymentCheckoutProvider {
  public mode(): PaymentCheckoutMode {
    return 'external_manual';
  }

  public createCheckoutUrl(booking: CheckoutBooking, config: PaymentGatewaySettings): string {
    return PaymentCheckoutUrl.create('stripe', config.stripePaymentLink).forPayment(
      booking.amount,
      booking.currency,
    );
  }
}
