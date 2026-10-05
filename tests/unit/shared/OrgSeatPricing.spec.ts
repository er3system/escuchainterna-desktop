import { describe, it, expect } from 'vitest';
import {
  ORG_MIN_SEATS,
  ORG_PRICE_FROM,
  ORG_SEAT_TIERS,
  formatCop,
  orgDiscountVsIndividual,
  orgSeatPrice,
  orgTierForSeats,
} from '@/shared/domain/orgSeatPricing';

describe('orgSeatPricing — precio por asiento de organizaciones', () => {
  it('asigna el tramo correcto en los bordes (2–4 / 5–9 / 10+)', () => {
    expect(orgTierForSeats(2).pricePerSeat).toBe(130_000);
    expect(orgTierForSeats(4).pricePerSeat).toBe(130_000);
    expect(orgTierForSeats(5).pricePerSeat).toBe(110_000);
    expect(orgTierForSeats(9).pricePerSeat).toBe(110_000);
    expect(orgTierForSeats(10).pricePerSeat).toBe(90_000);
    expect(orgTierForSeats(50).pricePerSeat).toBe(90_000);
  });

  it('cotiza el total mensual = asientos × precio del tramo', () => {
    expect(orgSeatPrice(3).monthlyTotal).toBe(3 * 130_000);
    expect(orgSeatPrice(6).monthlyTotal).toBe(6 * 110_000);
    expect(orgSeatPrice(12).monthlyTotal).toBe(12 * 90_000);
  });

  it('sanea asientos por debajo del mínimo (1 o menos → mínimo de organización)', () => {
    expect(orgSeatPrice(1).seats).toBe(ORG_MIN_SEATS);
    expect(orgSeatPrice(0).seats).toBe(ORG_MIN_SEATS);
    expect(orgSeatPrice(-5).seats).toBe(ORG_MIN_SEATS);
    expect(orgSeatPrice(3.9).seats).toBe(3); // trunca
  });

  it('el "desde" es el piso del último tramo', () => {
    expect(ORG_PRICE_FROM).toBe(90_000);
    expect(ORG_PRICE_FROM).toBe(ORG_SEAT_TIERS[ORG_SEAT_TIERS.length - 1].pricePerSeat);
  });

  it('calcula el descuento vs el plan individual de referencia', () => {
    // 149.000 individual; 10+ asientos a 90.000 → ~40% de descuento.
    expect(orgDiscountVsIndividual(12, 149_000)).toBeCloseTo(1 - 90_000 / 149_000, 5);
    // 2–4 a 130.000 → ~13%.
    expect(orgDiscountVsIndividual(3, 149_000)).toBeCloseTo(1 - 130_000 / 149_000, 5);
    // Sin precio de referencia válido → 0.
    expect(orgDiscountVsIndividual(12, 0)).toBe(0);
  });

  it('formatCop formatea COP sin decimales, separador de miles con punto', () => {
    // El símbolo/espaciado exacto depende de la versión de ICU; afirmamos lo estable:
    // separador de miles con punto, sin decimales y con símbolo de peso.
    expect(formatCop(90_000)).toContain('90.000');
    expect(formatCop(1_080_000)).toContain('1.080.000');
    expect(formatCop(90_000)).toContain('$');
    // Sin centavos: no aparece ",00".
    expect(formatCop(90_000)).not.toContain(',00');
  });

  it('los tramos son contiguos y sin huecos desde el mínimo', () => {
    expect(ORG_SEAT_TIERS[0].minSeats).toBe(ORG_MIN_SEATS);
    for (let i = 1; i < ORG_SEAT_TIERS.length; i += 1) {
      const prev = ORG_SEAT_TIERS[i - 1];
      expect(prev.maxSeats).not.toBeNull();
      expect(ORG_SEAT_TIERS[i].minSeats).toBe((prev.maxSeats as number) + 1);
    }
    expect(ORG_SEAT_TIERS[ORG_SEAT_TIERS.length - 1].maxSeats).toBeNull();
  });
});
