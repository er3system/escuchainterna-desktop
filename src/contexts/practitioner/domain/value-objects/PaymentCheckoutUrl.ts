import { InvalidPaymentCheckoutUrlError } from '../errors/InvalidPaymentCheckoutUrlError';
import type { PaymentGatewayProvider } from '../paymentGateways';

const PROVIDER_HOSTS: Record<PaymentGatewayProvider, string[]> = {
  stripe: ['buy.stripe.com'],
  mercado_pago: [
    'mpago.la',
    'mercadopago.com.ar',
    'mercadopago.com.br',
    'mercadopago.cl',
    'mercadopago.com.co',
    'mercadopago.com.mx',
    'mercadopago.com.pe',
    'mercadopago.com.uy',
  ],
  paypal: ['paypal.me'],
};

/** URL HTTPS de cobro perteneciente a la pasarela declarada. */
export class PaymentCheckoutUrl {
  private constructor(
    private readonly provider: PaymentGatewayProvider,
    private readonly url: URL,
  ) {}

  public static create(provider: PaymentGatewayProvider, rawUrl: string): PaymentCheckoutUrl {
    const parsed = PaymentCheckoutUrl.parse(rawUrl);
    if (!parsed || !PaymentCheckoutUrl.isAllowedHost(provider, parsed.hostname)) {
      throw new InvalidPaymentCheckoutUrlError(provider);
    }
    if (provider === 'paypal' && !PaymentCheckoutUrl.isPayPalMeProfile(parsed)) {
      throw new InvalidPaymentCheckoutUrlError(provider);
    }
    return new PaymentCheckoutUrl(provider, parsed);
  }

  public static isValid(provider: PaymentGatewayProvider, rawUrl: string): boolean {
    try {
      PaymentCheckoutUrl.create(provider, rawUrl);
      return true;
    } catch {
      return false;
    }
  }

  /** PayPal.me lleva monto/moneda en la ruta; los otros links ya fijan el precio. */
  public forPayment(amount: number, currency: string): string {
    if (this.provider !== 'paypal') return this.url.toString();
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      throw new InvalidPaymentCheckoutUrlError(this.provider);
    }
    const checkout = new URL(this.url.toString());
    const formattedAmount = amount.toFixed(2).replace(/\.?0+$/, '');
    checkout.pathname = `${checkout.pathname.replace(/\/$/, '')}/${formattedAmount}${currency}`;
    return checkout.toString();
  }

  private static parse(rawUrl: string): URL | null {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private static isAllowedHost(provider: PaymentGatewayProvider, hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/\.$/, '');
    if (provider === 'paypal') return normalized === 'paypal.me' || normalized === 'www.paypal.me';
    if (provider === 'stripe') return normalized === 'buy.stripe.com';
    return PROVIDER_HOSTS[provider].some(
      (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
    );
  }

  private static isPayPalMeProfile(url: URL): boolean {
    if (url.search || url.hash) return false;
    const pathSegments = url.pathname.split('/').filter(Boolean);
    return pathSegments.length === 1 && /^[a-z0-9]{1,20}$/i.test(pathSegments[0]);
  }
}
