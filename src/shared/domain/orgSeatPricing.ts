/**
 * Precios por ASIENTO para organizaciones/clínicas (módulo PURO: sin imports de
 * Node; lo consumen el landing y la calculadora del panel admin).
 *
 * El descuento depende de la cantidad de profesionales (asientos activos):
 * a más asientos, menor precio por profesional. Una persona sola usa el plan
 * individual; las organizaciones empiezan en 2. Moneda canónica: COP.
 */

export interface OrgSeatTier {
  /** Mínimo de asientos del tramo (inclusive). */
  minSeats: number;
  /** Máximo del tramo (inclusive) o null = sin tope. */
  maxSeats: number | null;
  /** Precio por profesional/mes en COP. */
  pricePerSeat: number;
  /** Etiqueta para la UI. */
  label: string;
}

/** Mínimo de asientos para el plan de organización (1 = plan individual). */
export const ORG_MIN_SEATS = 2;

/** Tramos por volumen. A más asientos, menor precio por profesional. */
export const ORG_SEAT_TIERS: readonly OrgSeatTier[] = [
  { minSeats: 2, maxSeats: 4, pricePerSeat: 130_000, label: '2–4 profesionales' },
  { minSeats: 5, maxSeats: 9, pricePerSeat: 110_000, label: '5–9 profesionales' },
  { minSeats: 10, maxSeats: null, pricePerSeat: 90_000, label: '10 o más profesionales' },
];

/** Precio "desde" para anclar el landing (el piso del último tramo). */
export const ORG_PRICE_FROM = ORG_SEAT_TIERS[ORG_SEAT_TIERS.length - 1].pricePerSeat;

/**
 * Formatea un monto en COP canónico ("$90.000"), sin decimales, locale es-CO.
 * Fuente única de formato para el precio de organizaciones (landing + admin):
 * el módulo es COP-only, así que NO se acopla a `formatPlanPrice` (multi-moneda
 * por catálogo). Puro: usa Intl, disponible en navegador y Node.
 */
export function formatCop(amount: number): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString('es-CO')}`;
  }
}

/** Asientos saneados a un entero ≥ ORG_MIN_SEATS. */
function normalizeSeats(seats: number): number {
  if (!Number.isFinite(seats)) return ORG_MIN_SEATS;
  return Math.max(ORG_MIN_SEATS, Math.trunc(seats));
}

/** Tramo que corresponde a una cantidad de asientos. */
export function orgTierForSeats(seats: number): OrgSeatTier {
  const normalized = normalizeSeats(seats);
  const tier = ORG_SEAT_TIERS.find(
    (candidate) => normalized >= candidate.minSeats && (candidate.maxSeats === null || normalized <= candidate.maxSeats),
  );
  // Por construcción siempre hay match (el último tramo no tiene tope).
  return tier ?? ORG_SEAT_TIERS[ORG_SEAT_TIERS.length - 1];
}

export interface OrgSeatQuote {
  seats: number;
  tier: OrgSeatTier;
  pricePerSeat: number;
  monthlyTotal: number;
}

/** Cotización por asiento: precio unitario del tramo y total mensual. */
export function orgSeatPrice(seats: number): OrgSeatQuote {
  const normalized = normalizeSeats(seats);
  const tier = orgTierForSeats(normalized);
  return {
    seats: normalized,
    tier,
    pricePerSeat: tier.pricePerSeat,
    monthlyTotal: tier.pricePerSeat * normalized,
  };
}

/**
 * Descuento del precio por asiento frente al precio del plan individual de
 * referencia (0–1). Presentación; el precio individual lo decide el catálogo.
 */
export function orgDiscountVsIndividual(seats: number, individualPrice: number): number {
  if (!Number.isFinite(individualPrice) || individualPrice <= 0) return 0;
  const { pricePerSeat } = orgSeatPrice(seats);
  return Math.max(0, 1 - pricePerSeat / individualPrice);
}
