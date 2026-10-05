import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft, Building2, Check, CheckCircle2 } from 'lucide-react';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import {
  formatPlanPrice,
  resolveCurrencyFromAcceptLanguage,
} from '@/shared/domain/planPricing';
import { ORG_PRICE_FROM, formatCop } from '@/shared/domain/orgSeatPricing';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { Logo } from '@/components/Logo';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { ActivatePlanButton } from './ActivatePlanButton';
import { logoutFromPaywallAction } from './actions';

export const metadata = { title: 'Suscripción · EscuchaInterna' };

export default async function SuscripcionPage() {
  const userId = await requireSessionUserId();
  if (isDesktopEdition()) redirect('/configuracion');
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context) redirect('/login');

  const subscription = context.subscription;
  const isPaidActive = subscription?.status === 'activa' && !subscription.expired;
  const isInTrial = subscription?.status === 'trial' && !subscription.expired;

  const headerList = await headers();
  const currency = resolveCurrencyFromAcceptLanguage(headerList.get('accept-language'));

  const plans = await listPlans();
  const selectablePlans = plans.filter((plan) => plan.id === 'esencial' || plan.id === 'profesional');
  const organizacionPlan = plans.find((plan) => plan.id === 'organizacion') ?? null;
  const currentPlanName = subscription
    ? plans.find((plan) => plan.id === subscription.plan)?.name ?? subscription.plan
    : null;

  const title = isPaidActive
    ? 'Tu suscripción'
    : isInTrial
      ? 'Elige tu plan'
      : 'Tu periodo de prueba terminó';
  const subtitle = isPaidActive
    ? `Tu plan actual es ${currentPlanName}. Puedes cambiarlo cuando quieras; el cambio aplica de inmediato.`
    : isInTrial
      ? `Estás en periodo de prueba del plan ${currentPlanName} (${subscription?.daysLeftInTrial} día${subscription?.daysLeftInTrial === 1 ? '' : 's'} restante${subscription?.daysLeftInTrial === 1 ? '' : 's'}). Activa un plan para no interrumpir tu práctica.`
      : `Gracias por probar EscuchaInterna, ${context.fullName || context.email}. Elige un plan para seguir potenciando tu práctica sin interrupciones.`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-3xl">
        <ImpersonationBanner />
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">{subtitle}</p>
          {subscription && currentPlanName ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 size={13} />
              Plan actual: {currentPlanName} ·{' '}
              {subscription.status === 'activa'
                ? 'suscripción activa'
                : subscription.status === 'trial'
                  ? subscription.expired
                    ? 'prueba vencida'
                    : 'en prueba'
                  : subscription.status}
            </p>
          ) : null}
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {selectablePlans.map((plan) => {
            const price = formatPlanPrice(plan.prices, currency);
            const isCurrent = isPaidActive && subscription?.plan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-card border bg-surface p-6 shadow-card ${
                  plan.highlighted ? 'border-primary dark:border-accent-2/60' : 'border-line'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white">
                    Más popular
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wide text-primary dark:text-accent-2">
                  Plan {plan.name}
                </p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-ink">
                    {price.formatted}
                  </span>
                  <span className="text-sm font-medium text-ink-soft">{price.currency} / mes</span>
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-ink">
                      <Check size={15} className="mt-0.5 shrink-0 text-primary dark:text-accent-2" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <ActivatePlanButton
                    planId={plan.id}
                    label={isPaidActive ? `Cambiar a ${plan.name}` : 'Activar plan'}
                    highlighted={plan.highlighted}
                    current={isCurrent}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {organizacionPlan ? (
          <div className="mt-5 flex items-start gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
              <Building2 size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">
                Plan {organizacionPlan.name} — desde {formatCop(ORG_PRICE_FROM)} COP /perfil al mes
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Precio por profesional que baja con el tamaño del equipo. Para clínicas y equipos de
                formación, con perfil maestro y supervisión de practicantes. Este plan no se activa desde aquí: contacta
                al administrador de tu institución para que te incluya, o escríbenos a{' '}
                <a
                  href="mailto:hola@escuchainterna.com"
                  className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
                >
                  hola@escuchainterna.com
                </a>
                .
              </p>
            </div>
          </div>
        ) : null}

        <p className="mt-5 flex items-center justify-center gap-1 text-center text-xs text-ink-soft">
          <CheckCircle2 size={13} className="text-success" />
          {isProduction()
            ? 'Durante el lanzamiento, activar tu plan no genera ningún cargo.'
            : 'Pago simulado en modo local: no se hará ningún cargo real.'}
        </p>

        <div className="mt-4 flex items-center justify-center gap-5">
          {subscription && !subscription.expired ? (
            <Link
              href={homePathForRole(context.role, context.onboardingCompleted)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink hover:underline"
            >
              <ArrowLeft size={13} />
              Volver a mi consulta
            </Link>
          ) : null}
          <form action={logoutFromPaywallAction}>
            <button
              type="submit"
              className="text-xs font-medium text-ink-soft hover:text-ink hover:underline"
            >
              Cerrar sesión y volver después
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
