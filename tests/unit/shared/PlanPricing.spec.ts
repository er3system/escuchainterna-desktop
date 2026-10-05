import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLAN_CURRENCY,
  LISTED_CURRENCIES,
  formatApproxFromCop,
  formatPlanPrice,
  resolveCurrencyFromAcceptLanguage,
} from '@/shared/domain/planPricing';

/** Normaliza espacios no separables de Intl (NBSP/NNBSP) para comparar sin fragilidad por runtime. */
function plain(formatted: string): string {
  return formatted.replace(/[\u00a0\u202f]/g, ' ');
}

const PRICES = { COP: 79000, MXN: 349, USD: 19, EUR: 18, ARS: 28000, CLP: 18000, PEN: 70 };

describe('resolveCurrencyFromAcceptLanguage', () => {
  it('sin header devuelve la moneda por defecto (COP)', () => {
    expect(resolveCurrencyFromAcceptLanguage(null)).toBe('COP');
    expect(resolveCurrencyFromAcceptLanguage('')).toBe('COP');
  });

  it('mapea las regiones de los mercados con precio de lista', () => {
    expect(resolveCurrencyFromAcceptLanguage('es-CO,es;q=0.9')).toBe('COP');
    expect(resolveCurrencyFromAcceptLanguage('es-MX,es;q=0.9,en;q=0.8')).toBe('MXN');
    expect(resolveCurrencyFromAcceptLanguage('es-ES')).toBe('EUR');
    expect(resolveCurrencyFromAcceptLanguage('es-AR')).toBe('ARS');
    expect(resolveCurrencyFromAcceptLanguage('es-CL')).toBe('CLP');
    expect(resolveCurrencyFromAcceptLanguage('es-PE')).toBe('PEN');
    expect(resolveCurrencyFromAcceptLanguage('en-US,en;q=0.9')).toBe('USD');
    expect(resolveCurrencyFromAcceptLanguage('es-PR')).toBe('USD');
  });

  it('cualquier otro país cae a COP', () => {
    expect(resolveCurrencyFromAcceptLanguage('es-UY,es;q=0.9')).toBe('COP');
    expect(resolveCurrencyFromAcceptLanguage('pt-BR')).toBe('COP');
  });

  it('ignora etiquetas sin región y respeta la calidad (q)', () => {
    expect(resolveCurrencyFromAcceptLanguage('es,en;q=0.5')).toBe('COP');
    // es-419 no es país (región UN M.49): se ignora y decide en-US.
    expect(resolveCurrencyFromAcceptLanguage('es-419,en-US;q=0.8')).toBe('USD');
    // La etiqueta con mayor q decide aunque venga después en el header.
    expect(resolveCurrencyFromAcceptLanguage('es-MX;q=0.7,es-AR;q=0.9')).toBe('ARS');
  });

  it('la región no distingue mayúsculas/minúsculas', () => {
    expect(resolveCurrencyFromAcceptLanguage('es-cl')).toBe('CLP');
  });
});

describe('formatPlanPrice', () => {
  it('formatea COP con locale es-CO: miles con punto y sin decimales', () => {
    const price = formatPlanPrice(PRICES, 'COP');
    expect(price.currency).toBe('COP');
    expect(price.amount).toBe(79000);
    expect(plain(price.formatted)).toContain('79.000');
    expect(price.formatted).not.toContain(',00');
  });

  it('formatea MXN y USD con su locale', () => {
    const mxn = formatPlanPrice(PRICES, 'MXN');
    expect(mxn.currency).toBe('MXN');
    expect(mxn.amount).toBe(349);
    expect(plain(mxn.formatted)).toContain('349');

    const usd = formatPlanPrice(PRICES, 'USD');
    expect(usd.currency).toBe('USD');
    expect(plain(usd.formatted)).toContain('19');
  });

  it('si el plan no tiene precio en la moneda pedida cae a COP', () => {
    const price = formatPlanPrice({ COP: 59000 }, 'MXN');
    expect(price.currency).toBe('COP');
    expect(price.amount).toBe(59000);
    expect(plain(price.formatted)).toContain('59.000');
  });

  it('moneda desconocida también cae a COP', () => {
    const price = formatPlanPrice(PRICES, 'XYZ');
    expect(price.currency).toBe('COP');
    expect(price.amount).toBe(79000);
  });
});

describe('formatApproxFromCop (equivalente aproximado del precio COP de organización)', () => {
  // Tasas por 1 COP (estilo ExchangeRates base COP).
  const RATES = { EUR: 0.00022, USD: 0.00024, MXN: 0.0044 };

  it('convierte y formatea en la moneda pedida', () => {
    // 90.000 COP * 0.00022 = 19.8 → €20 (redondeado, sin decimales).
    const eur = formatApproxFromCop(90_000, 'EUR', RATES);
    expect(eur).not.toBeNull();
    expect(plain(eur!)).toContain('20');

    const mxn = formatApproxFromCop(90_000, 'MXN', RATES);
    expect(plain(mxn!)).toContain('396');
  });

  it('devuelve null para COP (no aplica el equivalente)', () => {
    expect(formatApproxFromCop(90_000, 'COP', RATES)).toBeNull();
  });

  it('devuelve null sin tasas o con tasa inválida (la UI cae al COP canónico)', () => {
    expect(formatApproxFromCop(90_000, 'EUR', undefined)).toBeNull();
    expect(formatApproxFromCop(90_000, 'ARS', RATES)).toBeNull();
    expect(formatApproxFromCop(90_000, 'EUR', { EUR: 0 })).toBeNull();
    expect(formatApproxFromCop(90_000, 'EUR', { EUR: Number.NaN })).toBeNull();
  });
});

describe('catálogo de monedas con precio de lista', () => {
  it('son 7 monedas y COP es la por defecto', () => {
    expect(LISTED_CURRENCIES).toHaveLength(7);
    expect(LISTED_CURRENCIES).toContain(DEFAULT_PLAN_CURRENCY);
    expect(DEFAULT_PLAN_CURRENCY).toBe('COP');
  });
});
