import { SUPPORTED_CURRENCIES } from './currencies';

/**
 * Precios geo-adaptados de los planes (módulo PURO: sin imports de Node,
 * lo consumen client components de la landing y del paywall).
 *
 * Los planes guardan precios de LISTA por moneda en `plans.prices_json`
 * (p. ej. { COP: 79000, MXN: 349 }). La moneda por defecto del producto es COP.
 */

export const DEFAULT_PLAN_CURRENCY = 'COP';

/** Monedas con precio de lista en el catálogo de planes (orden del selector). */
export const LISTED_CURRENCIES: string[] = ['COP', 'MXN', 'USD', 'EUR', 'ARS', 'CLP', 'PEN'];

/** País (región del Accept-Language) → moneda de display. Otro país ⇒ COP. */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  MX: 'MXN',
  CO: 'COP',
  ES: 'EUR',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
  US: 'USD',
  PR: 'USD',
};

interface LanguageTag {
  tag: string;
  quality: number;
  index: number;
}

function parseAcceptLanguage(header: string): LanguageTag[] {
  const entries: LanguageTag[] = [];
  header.split(',').forEach((raw, index) => {
    const [tagPart, ...params] = raw.trim().split(';');
    const tag = tagPart?.trim() ?? '';
    if (!tag) return;
    let quality = 1;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key?.trim().toLowerCase() === 'q') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) quality = parsed;
      }
    }
    entries.push({ tag, quality, index });
  });
  // Mayor calidad primero; a igual calidad conserva el orden del header.
  return entries.sort((a, b) => b.quality - a.quality || a.index - b.index);
}

/**
 * Detecta la moneda de display a partir del header Accept-Language
 * ("es-CO,es;q=0.9" → COP, "es-MX" → MXN, "en-US" → USD…).
 * La primera etiqueta con región de país decide; país sin precio de lista
 * o header sin región ⇒ COP (moneda por defecto).
 */
export function resolveCurrencyFromAcceptLanguage(header: string | null): string {
  if (!header) return DEFAULT_PLAN_CURRENCY;
  for (const entry of parseAcceptLanguage(header)) {
    // Subtags tras el idioma: la región de país son exactamente 2 letras (es-CO, en-US, zh-Hant-TW).
    const subtags = entry.tag.split('-').slice(1);
    const region = subtags.find((subtag) => /^[a-zA-Z]{2}$/.test(subtag));
    if (!region) continue;
    return COUNTRY_TO_CURRENCY[region.toUpperCase()] ?? DEFAULT_PLAN_CURRENCY;
  }
  return DEFAULT_PLAN_CURRENCY;
}

export interface PlanPriceDisplay {
  /** Moneda efectivamente mostrada (cae a COP si el plan no tiene precio en la pedida). */
  currency: string;
  amount: number;
  /** Precio formateado con Intl.NumberFormat (es-CO para COP: miles con punto, sin decimales). */
  formatted: string;
}

/**
 * Convierte y formatea un monto COP a otra moneda de forma APROXIMADA, con las
 * tasas por 1 COP que provee el servidor (ExchangeRates base COP). Para montos
 * que se facturan en COP (organizaciones) pero se muestran junto a un selector
 * de moneda: la cifra convertida es orientativa, nunca el precio contractual.
 * Devuelve null si la moneda es COP (no aplica) o no hay tasa disponible.
 */
export function formatApproxFromCop(
  amountCop: number,
  currency: string,
  copRates: Record<string, number> | undefined,
): string | null {
  if (currency === DEFAULT_PLAN_CURRENCY) return null;
  const rate = copRates?.[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  const amount = amountCop * rate;
  const locale = SUPPORTED_CURRENCIES.find((item) => item.code === currency)?.locale ?? 'es-CO';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/**
 * Resuelve y formatea el precio de lista de un plan en la moneda pedida.
 * Si el plan no tiene precio en esa moneda cae a COP.
 */
export function formatPlanPrice(prices: Record<string, number>, currency: string): PlanPriceDisplay {
  const resolved = prices[currency] !== undefined ? currency : DEFAULT_PLAN_CURRENCY;
  const amount = prices[resolved] ?? 0;
  const locale =
    SUPPORTED_CURRENCIES.find((item) => item.code === resolved)?.locale ?? 'es-CO';
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolved,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    formatted = `${amount} ${resolved}`;
  }
  return { currency: resolved, amount, formatted };
}
