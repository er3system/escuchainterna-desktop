import { PaymentCheckoutUrl } from './value-objects/PaymentCheckoutUrl';

// Módulo puro (sin dependencias de Node) para que los client components
// puedan usar tipos, etiquetas y reglas de las pasarelas de cobro del
// profesional sin arrastrar node:sqlite/node:crypto al bundle del navegador.

/** Pasarelas con las que el paciente le paga DIRECTO al profesional. */
export type PaymentGatewayProvider = 'stripe' | 'mercado_pago' | 'paypal';

export const PAYMENT_GATEWAY_PROVIDERS: PaymentGatewayProvider[] = [
  'stripe',
  'mercado_pago',
  'paypal',
];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGatewayProvider, string> = {
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago',
  paypal: 'PayPal',
};

/**
 * Nombre del flujo REAL de vinculación de cuenta de cada proveedor.
 * En modo local /conectar/[provider] lo simula; en producción la pantalla
 * de autorización es del propio proveedor.
 */
export const PAYMENT_GATEWAY_OAUTH_FLOW: Record<PaymentGatewayProvider, string> = {
  stripe: 'Stripe Connect OAuth',
  mercado_pago: 'Mercado Pago OAuth',
  paypal: 'PayPal Partner Referrals',
};

export function isPaymentGatewayProvider(value: string): value is PaymentGatewayProvider {
  return (PAYMENT_GATEWAY_PROVIDERS as string[]).includes(value);
}

/** Países donde opera Mercado Pago (cuenta del profesional). */
export const MERCADO_PAGO_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'MX', name: 'México' },
  { code: 'PE', name: 'Perú' },
  { code: 'UY', name: 'Uruguay' },
];

/** Prefijo del id de cuenta vinculada SIMULADA por proveedor (modo local). */
export const SIMULATED_LINKED_ACCOUNT_PREFIX: Record<PaymentGatewayProvider, string> = {
  stripe: 'acct_demo_',
  mercado_pago: 'mp_usr_demo_',
  paypal: 'paypal_merchant_demo_',
};

/**
 * Genera el id de cuenta vinculada simulada (p. ej. acct_demo_k3f9x2).
 * Módulo puro: usa Math.random (no es criptográfico ni necesita serlo:
 * solo identifica visualmente la vinculación local).
 */
export function newSimulatedLinkedAccountId(provider: PaymentGatewayProvider): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${SIMULATED_LINKED_ACCOUNT_PREFIX[provider]}${suffix}`;
}

/**
 * Configuración de una pasarela tal como se persiste en
 * integration_connections.config_json (todas las claves son strings).
 *
 * Vinculación "con un clic" (camino principal, simulada en local):
 * - `linked_account_id`: id de la cuenta del profesional en el proveedor
 *   (acct_… / mp_usr_… / merchant id). Si existe, la pasarela queda
 *   configurada SIN credenciales manuales.
 * - `linked_at`: fecha ISO de la autorización.
 * - `link_method`: 'oauth' (vinculación) — vacío si solo hay config manual.
 *
 * Configuración manual / avanzada (alternativa):
 * - Stripe: `secret_key` O `payment_link` (link de Stripe Payment Links).
 * - Mercado Pago: `access_token` O `checkout_link` (link de Checkout Pro /
 *   link de pago) + `country`.
 * - PayPal: `client_id` O `paypal_me` (enlace PayPal.me).
 *
 * Todas: `show_payment_button` ('true'|'false') — toggle "Mostrar botón de
 * pago a mis pacientes".
 */
export interface PaymentGatewaySettings {
  provider: PaymentGatewayProvider;
  /** Toggle del profesional: mostrar el botón "Paga tu consulta" a pacientes. */
  showPaymentButton: boolean;
  /** Hay cuenta vinculada O credenciales/enlace suficientes para un checkout. */
  configured: boolean;
  // Vinculación de cuenta (OAuth simulado en local)
  linkedAccountId: string;
  linkedAt: string;
  linkMethod: string;
  // Stripe
  secretKey: string;
  stripePaymentLink: string;
  // Mercado Pago
  accessToken: string;
  checkoutLink: string;
  country: string;
  // PayPal
  clientId: string;
  paypalMeLink: string;
}

export function parsePaymentGatewaySettings(
  provider: PaymentGatewayProvider,
  config: Record<string, string>,
): PaymentGatewaySettings {
  const linkedAccountId = (config.linked_account_id ?? '').trim();
  const secretKey = (config.secret_key ?? '').trim();
  const stripePaymentLink = (config.payment_link ?? '').trim();
  const accessToken = (config.access_token ?? '').trim();
  const checkoutLink = (config.checkout_link ?? '').trim();
  const clientId = (config.client_id ?? '').trim();
  const paypalMeLink = (config.paypal_me ?? '').trim();
  const validStripePaymentLink = PaymentCheckoutUrl.isValid('stripe', stripePaymentLink);
  const validMercadoPagoLink = PaymentCheckoutUrl.isValid('mercado_pago', checkoutLink);
  const validPayPalMeLink = PaymentCheckoutUrl.isValid('paypal', paypalMeLink);
  const manuallyConfigured =
    provider === 'stripe'
      ? Boolean(secretKey || validStripePaymentLink)
      : provider === 'mercado_pago'
        ? Boolean(accessToken || validMercadoPagoLink)
        : Boolean(clientId || validPayPalMeLink);
  return {
    provider,
    showPaymentButton: config.show_payment_button === 'true',
    // Una cuenta vinculada por OAuth cuenta como configurada aunque no haya
    // credenciales manuales: el proveedor ya autorizó cobrar a su nombre.
    configured: Boolean(linkedAccountId) || manuallyConfigured,
    linkedAccountId,
    linkedAt: (config.linked_at ?? '').trim(),
    linkMethod: (config.link_method ?? '').trim(),
    secretKey,
    stripePaymentLink,
    accessToken,
    checkoutLink,
    country: (config.country ?? '').trim(),
    clientId,
    paypalMeLink,
  };
}

/** El botón "Paga tu consulta" solo se muestra si la pasarela está configurada (vinculada o manual) Y el toggle está activo. */
export function isGatewayActiveForPatients(settings: PaymentGatewaySettings): boolean {
  return settings.configured && settings.showPaymentButton;
}
