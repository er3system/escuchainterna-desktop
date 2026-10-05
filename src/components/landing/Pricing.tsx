import { headers } from 'next/headers';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import { resolveCurrencyFromAcceptLanguage, LISTED_CURRENCIES } from '@/shared/domain/planPricing';
import { getExchangeRates } from '@/shared/infrastructure/exchange-rates/ExchangeRates';
import { PricingPlans, type LandingPlan } from './PricingPlans';

/**
 * Tasas por 1 COP solo de las monedas del selector (payload mínimo al cliente).
 * Sirven para mostrar el equivalente APROXIMADO del precio de organización
 * (que se factura en COP) cuando el visitante elige otra moneda.
 */
export async function copRatesForSelector(): Promise<Record<string, number>> {
  const { rates } = await getExchangeRates('COP');
  const subset: Record<string, number> = {};
  for (const code of LISTED_CURRENCIES) {
    if (code !== 'COP' && Number.isFinite(rates[code])) subset[code] = rates[code];
  }
  return subset;
}

/** Línea de público objetivo por plan (copy de marketing, no vive en la BD). */
const PLAN_AUDIENCES: Record<string, string> = {
  esencial: 'Para empezar tu consulta con todo lo esencial',
  profesional: 'Para psicólogos independientes que quieren usar la IA a fondo',
  organizacion: 'Para clínicas y equipos de formación',
};

/**
 * Precios geo-adaptados: detecta la moneda por Accept-Language (default COP)
 * y renderiza los 3 planes del catálogo; el selector de moneda re-renderiza
 * client-side con los precios ya serializados.
 */
export async function Pricing() {
  const headerList = await headers();
  const currency = resolveCurrencyFromAcceptLanguage(headerList.get('accept-language'));
  const copRates = await copRatesForSelector();

  const plans: LandingPlan[] = (await listPlans()).map((plan) => ({
    id: plan.id,
    name: plan.name,
    audience: PLAN_AUDIENCES[plan.id] ?? '',
    prices: plan.prices,
    features: plan.features,
    highlighted: plan.highlighted,
    perProfile: plan.id === 'organizacion',
  }));

  return (
    <section id="precios" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">Precios</p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Precios claros, en tu moneda
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Empieza gratis y decide después. Los planes Esencial y Profesional incluyen 7 días de
            prueba, sin tarjeta; el plan de organizaciones se activa con nuestro acompañamiento.
          </p>
        </div>

        <PricingPlans plans={plans} initialCurrency={currency} copRates={copRates} />

        <p className="mt-10 text-center text-sm text-ink-soft">
          ¿Necesitas más de 20 perfiles o condiciones especiales?{' '}
          <a
            href="mailto:hola@escuchainterna.com"
            className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
          >
            Escríbenos
          </a>
          .
        </p>
      </div>
    </section>
  );
}
