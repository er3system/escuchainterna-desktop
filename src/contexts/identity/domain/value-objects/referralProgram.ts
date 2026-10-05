/**
 * Programa de referidos (v3 §11). Módulo PURO (sin imports de Node): lo
 * consumen client components (card de referidos) y el dominio de identidad.
 *
 * La configuración vive en platform_settings bajo la clave `referral_program`
 * y es editable desde /admin/planes.
 */

export const REFERRAL_PROGRAM_SETTINGS_KEY = 'referral_program';

export interface ReferralProgramConfig {
  /** Porcentaje de descuento que aporta CADA referido activo (default 20). */
  descuentoPorcentaje: number;
  /** Tope del descuento acumulado (default 100 = un mes gratis). */
  maxPorcentaje: number;
  /** Meses máximos que dura el beneficio por referido (informativo, default 12). */
  maxMeses: number;
}

export const DEFAULT_REFERRAL_PROGRAM: ReferralProgramConfig = {
  descuentoPorcentaje: 20,
  maxPorcentaje: 100,
  maxMeses: 12,
};

/** Parsea el JSON guardado en platform_settings; valores faltantes → defaults. */
export function parseReferralProgramConfig(json: string | null): ReferralProgramConfig {
  if (!json) return { ...DEFAULT_REFERRAL_PROGRAM };
  try {
    const raw = JSON.parse(json) as Partial<ReferralProgramConfig>;
    const sane = (value: unknown, fallback: number): number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
    return {
      descuentoPorcentaje: sane(raw.descuentoPorcentaje, DEFAULT_REFERRAL_PROGRAM.descuentoPorcentaje),
      maxPorcentaje: sane(raw.maxPorcentaje, DEFAULT_REFERRAL_PROGRAM.maxPorcentaje),
      maxMeses: sane(raw.maxMeses, DEFAULT_REFERRAL_PROGRAM.maxMeses),
    };
  } catch {
    return { ...DEFAULT_REFERRAL_PROGRAM };
  }
}

/** Descuento vigente: activos × descuentoPorcentaje, topado en maxPorcentaje. */
export function referralDiscountPercent(activeReferrals: number, config: ReferralProgramConfig): number {
  if (activeReferrals <= 0) return 0;
  return Math.min(config.maxPorcentaje, activeReferrals * config.descuentoPorcentaje);
}

/** precio × (1 − descuento/100), redondeado a 2 decimales (COP queda entero). */
export function applyReferralDiscount(amount: number, discountPercent: number): number {
  if (discountPercent <= 0) return amount;
  const factor = 1 - Math.min(100, discountPercent) / 100;
  return Math.round(amount * factor * 100) / 100;
}
