import { PaymentLinkProvider } from '../../domain/PaymentLinkProvider';

/**
 * Liga de pago simulada (ui-spec §5.5): el stub de Stripe genera
 * `http://localhost/pay/{id}` sin tocar la red.
 */
export class StubPaymentLinkProvider implements PaymentLinkProvider {
  public linkFor(bookingId: string): string {
    return `http://localhost/pay/${bookingId}`;
  }
}
