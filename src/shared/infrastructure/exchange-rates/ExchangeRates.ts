/**
 * Tasas de cambio APROXIMADAS para la función "conversión aproximada" de
 * ganancias. Solo informativo: nunca se usa para cobrar.
 *
 * Adaptador primario: open.er-api.com (gratuito, sin clave, ~160 monedas,
 * actualización diaria). Si no hay red (modo local) cae a una tabla estática.
 * Cache en memoria de 12 horas por moneda base.
 */

export interface ExchangeRatesResult {
  base: string;
  /** Unidades de cada moneda por 1 unidad de la base. */
  rates: Record<string, number>;
  source: 'open.er-api.com' | 'tabla-local';
  fetchedAt: string;
}

// Aproximaciones de junio de 2026 — SOLO fallback sin red.
const STATIC_USD_RATES: Record<string, number> = {
  USD: 1,
  MXN: 18.5,
  COP: 4200,
  EUR: 0.92,
  ARS: 1450,
  CLP: 950,
  PEN: 3.75,
  UYU: 41,
  PYG: 7600,
  BOB: 6.9,
  CRC: 520,
  DOP: 61,
  GTQ: 7.8,
  HNL: 26,
  NIO: 37,
  PAB: 1,
  VES: 95,
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const globalForRates = globalThis as unknown as {
  __escuchainternaRates?: Map<string, { result: ExchangeRatesResult; expiresAt: number }>;
};

function cache(): Map<string, { result: ExchangeRatesResult; expiresAt: number }> {
  if (!globalForRates.__escuchainternaRates) globalForRates.__escuchainternaRates = new Map();
  return globalForRates.__escuchainternaRates;
}

function staticRatesFor(base: string): ExchangeRatesResult {
  const usdPerBase = STATIC_USD_RATES[base] ?? 1;
  const rates: Record<string, number> = {};
  for (const [currency, perUsd] of Object.entries(STATIC_USD_RATES)) {
    rates[currency] = perUsd / usdPerBase;
  }
  return { base, rates, source: 'tabla-local', fetchedAt: new Date().toISOString() };
}

export async function getExchangeRates(base: string): Promise<ExchangeRatesResult> {
  const cached = cache().get(base);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let result: ExchangeRatesResult;
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { result: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates) throw new Error('respuesta inválida');
    result = { base, rates: data.rates, source: 'open.er-api.com', fetchedAt: new Date().toISOString() };
  } catch {
    result = staticRatesFor(base);
  }
  cache().set(base, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/** Convierte un monto entre monedas con las tasas dadas (vía la base). */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRatesResult,
): number | null {
  if (from === to) return amount;
  const fromRate = rates.base === from ? 1 : rates.rates[from];
  const toRate = rates.base === to ? 1 : rates.rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}
