// Módulo puro de la pantalla simulada de autorización (/conectar/[provider]).
// Solo presentación: nombre, color de marca y textos del consentimiento.

import {
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_OAUTH_FLOW,
  type PaymentGatewayProvider,
} from '@/contexts/practitioner/domain/paymentGateways';

export interface ConnectProviderMeta {
  name: string;
  /** Flujo real que esta pantalla simula (Stripe Connect OAuth, etc.). */
  realFlow: string;
  /** Color de marca del proveedor (solo para el logo-texto y el botón Autorizar). */
  accentColor: string;
  /** Logo-texto con la grafía del proveedor. */
  logoText: string;
}

export const CONNECT_PROVIDER_META: Record<PaymentGatewayProvider, ConnectProviderMeta> = {
  stripe: {
    name: PAYMENT_GATEWAY_LABELS.stripe,
    realFlow: PAYMENT_GATEWAY_OAUTH_FLOW.stripe,
    accentColor: '#635BFF',
    logoText: 'stripe',
  },
  mercado_pago: {
    name: PAYMENT_GATEWAY_LABELS.mercado_pago,
    realFlow: PAYMENT_GATEWAY_OAUTH_FLOW.mercado_pago,
    accentColor: '#009EE3',
    logoText: 'mercado pago',
  },
  paypal: {
    name: PAYMENT_GATEWAY_LABELS.paypal,
    realFlow: PAYMENT_GATEWAY_OAUTH_FLOW.paypal,
    accentColor: '#0070BA',
    logoText: 'PayPal',
  },
};

/**
 * Sanea el parámetro ?volver= (evita open redirects): solo rutas internas.
 */
export function safeReturnPath(value: string | undefined | null): string {
  const path = (value ?? '').trim();
  if (path.startsWith('/') && !path.startsWith('//')) return path;
  return '/configuracion/integraciones';
}
