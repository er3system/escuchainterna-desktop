/**
 * Agrupación de montos por moneda (módulo puro: importable desde client
 * components y server components). Lo usan /pagos y /inicio para mostrar
 * UN RENGLÓN POR MONEDA cuando las ganancias mezclan monedas.
 */

export interface CurrencyAmount {
  /** Código ISO de la moneda (p. ej. 'MXN', 'COP'). */
  currency: string;
  amount: number;
}

/**
 * Suma montos por moneda. Devuelve un renglón por moneda, ordenados por monto
 * descendente (la moneda con más dinero primero) y alfabético como desempate.
 */
export function groupAmountsByCurrency(
  items: Array<{ amount: number; currency: string }>,
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const code = item.currency || 'MXN';
    totals.set(code, (totals.get(code) ?? 0) + item.amount);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

/**
 * Renglones listos para una card: si no hay montos, muestra $0 en la moneda
 * del perfil para no dejar la card vacía.
 */
export function currencyLinesOrZero(
  totals: CurrencyAmount[],
  fallbackCurrency: string,
): CurrencyAmount[] {
  return totals.length > 0 ? totals : [{ currency: fallbackCurrency, amount: 0 }];
}
