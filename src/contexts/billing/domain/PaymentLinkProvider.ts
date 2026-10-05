/**
 * Puerto que genera la liga de pago de una reservación.
 * El adaptador local (stub de Stripe) produce ligas simuladas.
 */
export interface PaymentLinkProvider {
  linkFor(bookingId: string): string;
}
