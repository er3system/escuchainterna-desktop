import type { PaymentGatewaySettings } from './paymentGateways';

/** Datos mínimos de la sesión que necesita un checkout (nada clínico). */
export interface CheckoutBooking {
  bookingId: string;
  /** Monto a cobrar (en la moneda del profesional). */
  amount: number;
  /** Código de moneda ISO (MXN, ARS, USD…). */
  currency: string;
  /** Concepto visible para el paciente, p. ej. «Sesión con Dra. Pérez». */
  concept: string;
}

export type PaymentCheckoutMode = 'local_simulation' | 'external_manual';

/**
 * Puerto de checkout de pago: dado un booking y la configuración de la
 * pasarela del profesional, produce la URL a la que se envía al paciente
 * para pagar su consulta.
 *
 * Adaptadores (infrastructure/payments/):
 * - LocalSimulatedCheckout — hoy: apunta a la página pública /sesion/<id>
 *   con el checkout simulado abierto.
 * - MercadoPagoCheckout — futuro: Checkout Pro (preferencia → init_point).
 * - PayPalCheckout — futuro: Orders API v2 (order → approval link).
 */
export interface PaymentCheckoutProvider {
  mode(): PaymentCheckoutMode;
  createCheckoutUrl(booking: CheckoutBooking, config: PaymentGatewaySettings): string;
}
