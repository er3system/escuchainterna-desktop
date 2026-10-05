/**
 * Monedas soportadas (módulo puro: importable desde client components).
 * Países de habla hispana + dólar estadounidense.
 */

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'MXN', name: 'Peso mexicano', symbol: '$', locale: 'es-MX' },
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro (España)', symbol: '€', locale: 'es-ES' },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', locale: 'es-CO' },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', locale: 'es-AR' },
  { code: 'CLP', name: 'Peso chileno', symbol: '$', locale: 'es-CL' },
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', locale: 'es-PE' },
  { code: 'UYU', name: 'Peso uruguayo', symbol: '$U', locale: 'es-UY' },
  { code: 'PYG', name: 'Guaraní paraguayo', symbol: '₲', locale: 'es-PY' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs', locale: 'es-BO' },
  { code: 'CRC', name: 'Colón costarricense', symbol: '₡', locale: 'es-CR' },
  { code: 'DOP', name: 'Peso dominicano', symbol: 'RD$', locale: 'es-DO' },
  { code: 'GTQ', name: 'Quetzal guatemalteco', symbol: 'Q', locale: 'es-GT' },
  { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', locale: 'es-HN' },
  { code: 'NIO', name: 'Córdoba nicaragüense', symbol: 'C$', locale: 'es-NI' },
  { code: 'PAB', name: 'Balboa panameño', symbol: 'B/.', locale: 'es-PA' },
  { code: 'VES', name: 'Bolívar venezolano', symbol: 'Bs.', locale: 'es-VE' },
];

export function formatMoney(amount: number, currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find((item) => item.code === currencyCode);
  try {
    return new Intl.NumberFormat(currency?.locale ?? 'es-MX', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currency?.symbol ?? '$'} ${amount.toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Monto con el código ISO siempre visible («$ 1.500,00 COP»). Úsalo en los
 * hubs multi-moneda (organización, supervisión, admin) donde el símbolo «$»
 * a secas es ambiguo entre divisas latinoamericanas.
 */
export function formatMoneyWithCode(amount: number, currencyCode: string): string {
  const formatted = formatMoney(amount, currencyCode);
  return formatted.includes(currencyCode) ? formatted : `${formatted} ${currencyCode}`;
}
