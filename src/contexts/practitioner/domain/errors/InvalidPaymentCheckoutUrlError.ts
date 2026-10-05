import { DomainError } from '@/shared/domain/DomainError';
import type { PaymentGatewayProvider } from '../paymentGateways';

const PROVIDER_NAMES: Record<PaymentGatewayProvider, string> = {
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago',
  paypal: 'PayPal',
};

export class InvalidPaymentCheckoutUrlError extends DomainError {
  public constructor(provider: PaymentGatewayProvider) {
    super(`El enlace de pago configurado no pertenece a ${PROVIDER_NAMES[provider]}.`);
  }
}
