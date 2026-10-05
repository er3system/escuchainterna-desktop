'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Globe } from 'lucide-react';
import { formatPlanPrice, formatApproxFromCop, LISTED_CURRENCIES } from '@/shared/domain/planPricing';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { ORG_PRICE_FROM, formatCop } from '@/shared/domain/orgSeatPricing';

/** Datos planos y serializables de un plan (vienen de listPlans() en el servidor). */
export interface LandingPlan {
  id: string;
  name: string;
  audience: string;
  prices: Record<string, number>;
  features: string[];
  highlighted: boolean;
  /** true ⇒ precio "desde X /perfil al mes" (plan organizacion). */
  perProfile: boolean;
}

const SELECTOR_OPTIONS = LISTED_CURRENCIES.map((code) => ({
  code,
  label: SUPPORTED_CURRENCIES.find((item) => item.code === code)?.name ?? code,
}));

export function PricingPlans({
  plans,
  initialCurrency,
  copRates,
}: {
  plans: LandingPlan[];
  initialCurrency: string;
  /** Tasas por 1 COP (subset del selector) para el equivalente ≈ del plan organización. */
  copRates?: Record<string, number>;
}) {
  const [currency, setCurrency] = useState(initialCurrency);

  return (
    <div>
      <div className="mt-10 flex items-center justify-center gap-2">
        <Globe className="h-4 w-4 text-ink-soft" aria-hidden="true" />
        <label htmlFor="moneda-precios" className="text-sm font-medium text-ink-soft">
          Ver precios en
        </label>
        <select
          id="moneda-precios"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink outline-none transition focus:border-primary dark:focus:border-accent-2 focus:ring-2 focus:ring-primary-light"
        >
          {SELECTOR_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code} — {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl gap-8 md:grid-cols-3">
        {plans.map((plan) => {
          const price = formatPlanPrice(plan.prices, currency);
          // El plan de organización se cotiza por asiento (COP canónico) en la
          // calculadora; aquí anclamos el "desde" a ese mismo precio para no
          // mostrar dos cifras de organización distintas en la página. Pero el
          // selector de moneda MANDA: en moneda ≠ COP se muestra el equivalente
          // aproximado (≈, tasa del día) en vez de ignorar la elección del
          // visitante — la facturación sigue siendo en COP y la letra lo dice.
          const isOrg = plan.perProfile;
          const orgApprox = isOrg ? formatApproxFromCop(ORG_PRICE_FROM, currency, copRates) : null;
          const priceFormatted = isOrg
            ? (orgApprox ? `≈ ${orgApprox}` : formatCop(ORG_PRICE_FROM))
            : price.formatted;
          const priceCurrency = isOrg ? (orgApprox ? currency : 'COP') : price.currency;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-surface p-8 transition-all ${
                plan.highlighted
                  ? 'ring-eco border-primary/60 dark:border-accent-2/60 shadow-elev-lg'
                  : 'border-line shadow-elev-sm hover:-translate-y-1 hover:shadow-elev-md'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white">
                  Más popular
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-ink">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{plan.audience}</p>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {plan.perProfile && (
                  <span className="text-sm font-medium text-ink-soft">desde</span>
                )}
                <span className="font-display text-4xl font-extrabold tracking-tight text-ink tabular-nums">
                  {priceFormatted}
                </span>
                <span className="text-sm font-medium text-ink-soft">
                  {priceCurrency} {plan.perProfile ? '/perfil al mes' : '/ mes'}
                </span>
              </p>
              {isOrg ? (
                <p className="mt-2 text-xs text-ink-soft">
                  {orgApprox
                    ? `Equivalente aproximado — se factura en COP (${formatCop(ORG_PRICE_FROM)}). El precio por profesional baja con el tamaño del equipo.`
                    : 'El precio por profesional baja con el tamaño del equipo.'}
                </p>
              ) : null}
              {isOrg ? (
                <p className="mt-3 inline-flex w-fit items-center rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                  Implementación acompañada — escríbenos
                </p>
              ) : (
                <p className="mt-3 inline-flex w-fit items-center rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                  7 días gratis, sin tarjeta
                </p>
              )}

              <ul className="mt-7 flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-accent-2" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={isOrg ? '#precio-equipo' : '/registro'}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'border border-line text-ink hover:border-primary dark:hover:border-accent-2/60 hover:text-primary dark:hover:text-accent-2'
                }`}
              >
                {isOrg ? 'Calcula tu precio' : 'Iniciar prueba gratis'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
