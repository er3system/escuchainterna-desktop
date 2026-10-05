import { headers } from 'next/headers';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import {
  ORG_SEAT_TIERS,
  ORG_PRICE_FROM,
  formatCop,
  type OrgSeatTier,
} from '@/shared/domain/orgSeatPricing';
import { resolveCurrencyFromAcceptLanguage } from '@/shared/domain/planPricing';
import { copRatesForSelector } from './Pricing';
import { OrgSeatCalculatorClient } from './OrgSeatCalculatorClient';

/**
 * Calculadora de precio por asiento para organizaciones (landing). SERVER
 * component fino: lee el precio individual de referencia del catálogo (plan
 * 'profesional') y serializa los tramos; toda la interacción vive en el client.
 *
 * Va sobre `bg-bg` (no `bg-surface`) para que la cadencia sea oscuro (B2B) →
 * base (esta) → blanco (Pricing) y no se lea como un solo bloque con Pricing.
 */
export async function OrgSeatCalculator() {
  const individualRef =
    (await listPlans()).find((plan) => plan.id === 'profesional')?.prices.COP ?? 149_000;
  // Moneda del visitante (Accept-Language) + tasas por 1 COP: el total del
  // equipo se factura en COP, pero a un visitante de otra región se le muestra
  // también el equivalente aproximado (coherente con el selector de Precios).
  const displayCurrency = resolveCurrencyFromAcceptLanguage(
    (await headers()).get('accept-language'),
  );
  const copRates = await copRatesForSelector();

  // Tramos planos y serializables (maxSeats es number | null en el tramo 10+).
  const tiers: OrgSeatTier[] = ORG_SEAT_TIERS.map((tier) => ({
    minSeats: tier.minSeats,
    maxSeats: tier.maxSeats ?? null,
    pricePerSeat: tier.pricePerSeat,
    label: tier.label,
  }));

  return (
    <section id="precio-equipo" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
            Organizaciones · Precio por equipo
          </p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Calcula el precio para tu equipo
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Mueve el control y mira en vivo cuánto cuesta para tu clínica o equipo. A más
            profesionales, menor precio por cada uno —{' '}
            <span className="font-semibold text-ink">
              desde {formatCop(ORG_PRICE_FROM)} por profesional / mes
            </span>
            .
          </p>
        </div>

        <OrgSeatCalculatorClient
          tiers={tiers}
          individualRef={individualRef}
          displayCurrency={displayCurrency}
          copRates={copRates}
        />
      </div>
    </section>
  );
}
