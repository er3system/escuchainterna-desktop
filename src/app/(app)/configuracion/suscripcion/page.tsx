import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  Coins,
  History,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { applyReferralDiscount } from '@/contexts/identity/domain/value-objects/referralProgram';
import { forbidAssistantRole } from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import {
  formatPlanPrice,
  resolveCurrencyFromAcceptLanguage,
} from '@/shared/domain/planPricing';
import { formatMoney } from '@/shared/domain/currencies';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import { Card, PageHeader } from '@/components/ui';
import { ActivatePlanButton } from '@/app/suscripcion/ActivatePlanButton';
import { ReferralCard } from './ReferralCard';
import { CancelSubscriptionControls } from './CancelSubscriptionControls';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export const metadata = { title: 'Mi suscripción · EscuchaInterna' };

const DAY_MS = 24 * 60 * 60 * 1000;

interface PaymentRow {
  paid_at: string;
  amount: number;
  currency: string;
  provider: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Día del ciclo (1..length) y porcentaje, a partir de la fecha de fin. */
function cycleProgress(endIso: string, lengthDays: number): { day: number; percent: number } {
  const end = new Date(endIso).getTime();
  const start = end - lengthDays * DAY_MS;
  const day = Math.min(lengthDays, Math.max(1, Math.floor((Date.now() - start) / DAY_MS) + 1));
  return { day, percent: Math.round((day / lengthDays) * 100) };
}

export default async function MiSuscripcionPage() {
  const userId = await forbidAssistantRole();
  if (isDesktopEdition()) redirect('/configuracion');
  const useCases = createIdentityUseCases();
  const context = await useCases.getSessionContext.get(userId);
  if (!context) redirect('/login');

  const subscription = context.subscription;
  const plans = await listPlans();
  const currentPlan = subscription
    ? plans.find((plan) => plan.id === subscription.plan) ?? null
    : null;

  const memberSinceRow = (await getDatabaseAdapter().queryRow(
    'SELECT created_at FROM users WHERE id = ?',
    [userId],
  )) as { created_at: string } | null;

  const payments = (await getDatabaseAdapter().query(
    `SELECT sp.paid_at, sp.amount, sp.currency, sp.provider
         FROM subscription_payments sp
         JOIN subscriptions s ON s.id = sp.subscription_id
        WHERE s.user_id = ?
        ORDER BY sp.paid_at DESC`,
    [userId],
  )) as unknown as PaymentRow[];

  const referral = await useCases.getReferralSummary.get(userId);
  const referralLink = `${getAppBaseUrl()}/registro?ref=${referral.code}`;

  const headerList = await headers();
  const currency = resolveCurrencyFromAcceptLanguage(headerList.get('accept-language'));
  const listPrice = currentPlan ? formatPlanPrice(currentPlan.prices, currency) : null;
  const discountedAmount = listPrice
    ? applyReferralDiscount(listPrice.amount, referral.discountPercent)
    : null;

  // Cuentas sin cobro directo: admin (plataforma) y miembros de organización.
  const coveredBy =
    context.role === 'admin'
      ? 'Cubierta por la plataforma'
      : context.organization
        ? `Cubierta por tu organización (${context.organization.name})`
        : null;

  const isTrial = subscription?.status === 'trial';
  const cycle = subscription
    ? isTrial
      ? cycleProgress(subscription.trialEndsAt, 7)
      : subscription.currentPeriodEnd
        ? cycleProgress(subscription.currentPeriodEnd, 30)
        : null
    : null;
  const cycleLength = isTrial ? 7 : 30;

  const nextCharge = !subscription
    ? '—'
    : subscription.status === 'activa' && subscription.currentPeriodEnd
      ? formatDate(subscription.currentPeriodEnd)
      : isTrial
        ? `Fin de tu prueba: ${formatDate(subscription.trialEndsAt)}`
        : 'Sin renovación';

  const statusLabel = !subscription
    ? 'Sin suscripción'
    : subscription.status === 'activa'
      ? subscription.canceledAt
        ? 'Cancelada (acceso vigente)'
        : 'Activa'
      : isTrial
        ? subscription.expired
          ? 'Prueba vencida'
          : 'En prueba'
        : subscription.status === 'vencida'
          ? 'Vencida'
          : 'Cancelada';

  const selectablePlans = plans.filter((plan) => plan.id === 'esencial' || plan.id === 'profesional');

  return (
    <div>
      <PageHeader
        title="Mi suscripción"
        subtitle={`${context.fullName || context.email} · Miembro desde ${formatDate(
          memberSinceRow?.created_at ?? null,
        )}`}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary">
            <BadgeCheck size={14} />
            Plan {currentPlan?.name ?? subscription?.plan ?? '—'} · {statusLabel}
          </span>
        }
      />

      {coveredBy ? (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-success-soft/60 p-4">
          {context.role === 'admin' ? (
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <Building2 size={18} className="mt-0.5 shrink-0 text-success" />
          )}
          <p className="text-sm text-ink">
            <strong>{coveredBy}.</strong> No se te hace ningún cobro: tu acceso está garantizado sin
            pasos adicionales.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
            <Coins size={16} /> Costo
          </div>
          {coveredBy ? (
            <p className="text-2xl font-bold text-ink">Sin costo para ti</p>
          ) : listPrice && discountedAmount !== null ? (
            <>
              <p className="flex items-baseline gap-2">
                {referral.discountPercent > 0 ? (
                  <span className="text-sm font-medium text-ink-soft line-through">
                    {listPrice.formatted}
                  </span>
                ) : null}
                <span className="text-2xl font-bold text-ink">
                  {formatMoney(discountedAmount, listPrice.currency)}
                </span>
                <span className="text-sm font-semibold text-ink-soft">
                  {listPrice.currency} / mes
                </span>
              </p>
              {referral.discountPercent > 0 ? (
                <p className="mt-1 text-xs font-medium text-success">
                  {referral.activeCount} referido{referral.activeCount === 1 ? '' : 's'} activo
                  {referral.activeCount === 1 ? '' : 's'}: −{referral.discountPercent}%
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-soft">
                  Refiere colegas y obtén hasta {referral.config.maxPorcentaje}% de descuento.
                </p>
              )}
            </>
          ) : (
            <p className="text-2xl font-bold text-ink">—</p>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
            <CalendarClock size={16} /> Próximo cobro
          </div>
          <p className="text-2xl font-bold text-ink">{coveredBy ? 'No aplica' : nextCharge}</p>
          {!coveredBy && isTrial ? (
            <p className="mt-1 text-xs text-ink-soft">
              Activa tu plan antes de esa fecha para no interrumpir tu práctica.
            </p>
          ) : null}
        </Card>

        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
            <RefreshCcw size={16} /> Ciclo actual
          </div>
          {cycle ? (
            <>
              <p className="text-2xl font-bold text-ink">
                Día {cycle.day} de {cycleLength}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(3, cycle.percent)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {isTrial ? 'Periodo de prueba' : 'Periodo de facturación de 30 días'}
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-ink">—</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <History size={17} className="text-primary" />
            <h2 className="text-base font-bold text-ink">Historial de pagos</h2>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aún no hay pagos registrados{isTrial ? ' (estás en periodo de prueba)' : ''}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Monto</th>
                    <th className="py-2 pr-3">Moneda</th>
                    <th className="py-2">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={`${payment.paid_at}-${payment.amount}`} className="border-b border-line/60">
                      <td className="py-2 pr-3 text-ink">{formatDate(payment.paid_at)}</td>
                      <td className="py-2 pr-3 font-semibold text-ink">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>
                      <td className="py-2 pr-3 text-ink-soft">{payment.currency}</td>
                      <td className="py-2 capitalize text-ink-soft">{payment.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!coveredBy ? (
            <Link
              href="/suscripcion"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              {subscription?.status === 'activa' ? 'Renovar suscripción' : 'Activar suscripción'}
            </Link>
          ) : null}
          {!coveredBy && subscription?.status === 'activa' ? (
            <CancelSubscriptionControls
              canceled={subscription.canceledAt !== null}
              accessUntilLabel={formatDate(subscription.currentPeriodEnd)}
            />
          ) : null}
        </Card>

        <ReferralCard
          link={referralLink}
          code={referral.code}
          registeredCount={referral.registeredCount}
          activeCount={referral.activeCount}
          discountPercent={referral.discountPercent}
          programPercent={referral.config.descuentoPorcentaje}
          maxPercent={referral.config.maxPorcentaje}
          maxMonths={referral.config.maxMeses}
        />
      </div>

      {!coveredBy ? (
        <div className="mt-8">
          <h2 className="mb-1 text-lg font-bold text-ink">Comparación de planes</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Cambia de plan cuando quieras; el cambio aplica de inmediato con un nuevo periodo de 30 días.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {selectablePlans.map((plan) => {
              const price = formatPlanPrice(plan.prices, currency);
              const isCurrent = subscription?.status === 'activa' && subscription.plan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-card border bg-surface p-5 shadow-card ${
                    isCurrent ? 'border-primary' : 'border-line'
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                    Plan {plan.name}
                  </p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-ink">
                      {price.formatted}
                    </span>
                    <span className="text-sm font-medium text-ink-soft">{price.currency} / mes</span>
                  </p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                        <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <ActivatePlanButton
                      planId={plan.id}
                      label={`Cambiar a ${plan.name}`}
                      highlighted={plan.highlighted}
                      current={isCurrent}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Pago simulado en modo local: no se hará ningún cargo real. El descuento por referidos se
            aplica automáticamente al monto del cobro.
          </p>
        </div>
      ) : null}
    </div>
  );
}
