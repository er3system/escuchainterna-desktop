import Link from 'next/link';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Coins,
  CreditCard,
  Gift,
  MapPin,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { CalendarBookings } from '@/contexts/scheduling/application/calendar-bookings/CalendarBookings';
import { CalendarBookingsQuery } from '@/contexts/scheduling/application/calendar-bookings/CalendarBookingsQuery';
import { SqliteBookingCalendarReadModel } from '@/contexts/scheduling/infrastructure/persistence/SqliteBookingCalendarReadModel';
import { SqlitePlatformSettingsRepository } from '@/contexts/identity/infrastructure/persistence/SqlitePlatformSettingsRepository';
import {
  parseReferralProgramConfig,
  REFERRAL_PROGRAM_SETTINGS_KEY,
} from '@/contexts/identity/domain/value-objects/referralProgram';
import { GetDashboardMetrics } from '@/contexts/billing/application/get-dashboard-metrics/GetDashboardMetrics';
import { PaymentMethod } from '@/contexts/billing/domain/value-objects/PaymentMethod';
import {
  currencyLinesOrZero,
  type CurrencyAmount,
} from '@/contexts/billing/domain/value-objects/currencyTotals';
import { SqliteBillingProfileRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBillingProfileRepository';
import { SqliteDashboardMetricsReader } from '@/contexts/billing/infrastructure/persistence/SqliteDashboardMetricsReader';
import { formatMoney } from '@/shared/domain/currencies';
import { forbidAssistantRole, forbidProfessorRole } from '@/shared/infrastructure/auth/dataOwner';
import { Card, EmptyState } from '@/components/ui';
import { HistoryChart } from './HistoryChart';
import { OnboardingChecklist } from './OnboardingChecklist';
import { getOnboardingState, isOnboardingDismissed } from './onboarding';

const MX_PERCENT = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function money(amount: number, currency: string): string {
  return `${formatMoney(amount, currency)} ${currency}`;
}

/** Renglones de montos: uno por moneda cuando hay ingresos en varias. */
function MoneyLines({ totals, fallbackCurrency }: { totals: CurrencyAmount[]; fallbackCurrency: string }) {
  const lines = currencyLinesOrZero(totals, fallbackCurrency);
  return (
    <>
      {lines.map((line) => (
        <p
          key={line.currency}
          className={lines.length > 1 ? 'text-xl font-bold text-ink' : 'text-2xl font-bold text-ink'}
        >
          {formatMoney(line.amount, line.currency)}{' '}
          <span className="text-sm font-semibold text-ink-soft">{line.currency}</span>
        </p>
      ))}
    </>
  );
}

/** Total por moneda en una sola línea («$ 1,500.00 MXN + $ 200.000 COP»). */
function moneyLabel(totals: CurrencyAmount[], fallbackCurrency: string): string {
  return currencyLinesOrZero(totals, fallbackCurrency)
    .map((line) => money(line.amount, line.currency))
    .join(' + ');
}

function genderLabel(gender: string): string {
  const normalized = gender.trim().toLocaleLowerCase('es-MX');
  if (!normalized || normalized === 'sin especificar') return 'Sin especificar';
  return normalized.charAt(0).toLocaleUpperCase('es-MX') + normalized.slice(1);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <p className="mt-1 text-xs text-ink-soft">Sin datos del mes anterior</p>;
  }
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '+' : ''}
      {MX_PERCENT.format(change)} % vs mes anterior
    </p>
  );
}

/**
 * Comparación mensual de montos: solo tiene sentido cuando ambos meses están
 * en UNA misma moneda; si hay mezcla, comparar sumas sería engañoso.
 */
function MoneyDelta({ current, previous }: { current: CurrencyAmount[]; previous: CurrencyAmount[] }) {
  if (previous.length === 0) {
    return <p className="mt-1 text-xs text-ink-soft">Sin datos del mes anterior</p>;
  }
  if (current.length > 1 || previous.length > 1 || current[0]?.currency !== previous[0]?.currency) {
    return <p className="mt-1 text-xs text-ink-soft">Comparación no disponible (varias monedas)</p>;
  }
  return <Delta current={current[0]?.amount ?? 0} previous={previous[0].amount} />;
}

const BOOKING_STATUS_TONE: Record<string, string> = {
  agendada: 'bg-primary-light text-primary',
  confirmada: 'bg-success-soft text-success',
  completada: 'bg-success-soft text-success',
  cancelada: 'bg-danger-soft text-danger',
  inasistencia: 'bg-warning-soft text-warning',
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  inasistencia: 'Inasistencia',
};

interface TodayBookingItem {
  id: string;
  startAt: string;
  patientName: string;
  modality: 'presencial' | 'virtual';
  status: string;
  agendaColor: string;
  agendaName: string;
}

/** «Tu agenda de hoy»: timeline de las reservas del día del profesional. */
function TodayAgenda({ bookings, todayIso }: { bookings: TodayBookingItem[]; todayIso: string }) {
  const dayLink = `/agenda?vista=dia&fecha=${todayIso}`;
  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <CalendarDays size={18} className="text-primary dark:text-accent-2" /> Tu agenda de hoy
        </h2>
        <Link
          href={dayLink}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary dark:text-accent-2 hover:underline"
        >
          Ver agenda <ArrowRight size={14} />
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-bg/50 px-6 py-10 text-center">
          <CalendarCheck2 size={28} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-base font-semibold text-ink">No tienes sesiones hoy</p>
          <p className="mt-1 text-sm text-ink-soft">
            Disfruta tu día o agenda una nueva sesión desde la agenda.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {bookings.map((booking) => {
            const start = parseISO(booking.startAt);
            const cancelled = booking.status === 'cancelada';
            return (
              <li key={booking.id}>
                <Link
                  href={dayLink}
                  className="flex items-center gap-4 py-3 transition hover:bg-bg"
                >
                  <span
                    className={`flex w-14 items-center gap-1 text-sm font-bold tabular-nums ${
                      cancelled ? 'text-ink-soft line-through' : 'text-ink'
                    }`}
                  >
                    <Clock size={13} className="text-ink-soft" />
                    {format(start, 'HH:mm')}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: booking.agendaColor }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        cancelled ? 'text-ink-soft line-through' : 'text-ink'
                      }`}
                    >
                      {booking.patientName}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{booking.agendaName}</span>
                  </span>
                  <span className="hidden items-center gap-1 text-xs text-ink-soft sm:inline-flex">
                    {booking.modality === 'virtual' ? <Video size={13} /> : <MapPin size={13} />}
                    {booking.modality === 'virtual' ? 'Virtual' : 'Presencial'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      BOOKING_STATUS_TONE[booking.status] ?? 'bg-bg text-ink-soft'
                    }`}
                  >
                    {BOOKING_STATUS_LABEL[booking.status] ?? booking.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default async function InicioPage() {
  // El profesor (supervisa, no atiende) no tiene un tablero de consulta: su inicio es /supervision.
  await forbidProfessorRole();
  // El asistente no ve las métricas de ingresos del titular: su inicio es /agenda.
  const ownerUserId = await forbidAssistantRole();

  // Checklist de primeros pasos: visible hasta que se completa o se oculta.
  const onboarding = await getOnboardingState(ownerUserId);
  const showOnboarding = !onboarding.allDone && !(await isOnboardingDismissed(ownerUserId));

  const profile = await new SqliteBillingProfileRepository(ownerUserId).findCurrent();
  const currency = profile?.currency ?? 'MXN';
  const metrics = await new GetDashboardMetrics(new SqliteDashboardMetricsReader(ownerUserId)).get();

  const now = new Date();
  const firstName = (profile?.fullName ?? '').trim().split(/\s+/)[0] || '';
  const monthLabel = format(now, 'LLLL yyyy', { locale: es });

  // Banner del programa de referidos (v3 §11).
  const referralProgram = parseReferralProgramConfig(
    await new SqlitePlatformSettingsRepository().get(REFERRAL_PROGRAM_SETTINGS_KEY),
  );

  // «Tu agenda de hoy»: reservas del profesional para el día en curso, por hora.
  const todayBookings: TodayBookingItem[] = (
    await new CalendarBookings(new SqliteBookingCalendarReadModel(ownerUserId)).list(
      new CalendarBookingsQuery({
        fromIso: startOfDay(now).toISOString(),
        toIso: endOfDay(now).toISOString(),
      }),
    )
  )
    .map((booking) => ({
      id: booking.id,
      startAt: booking.startAt,
      patientName: booking.patientName,
      modality: booking.modality,
      status: booking.status,
      agendaColor: booking.agendaColor,
      agendaName: booking.agendaName,
    }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const todayIso = format(now, 'yyyy-MM-dd');

  return (
    <div>
      <div className="ei-welcome mb-6 rounded-[1.5rem] border border-line p-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-accent-strong">Un nuevo día en tu consulta</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{firstName ? `Hola, ${firstName}` : 'Hola'}</h1>
        <p className="mt-1 text-sm capitalize text-ink-soft">
          {format(now, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {showOnboarding ? <OnboardingChecklist state={onboarding} /> : null}

      {!isDesktopEdition() ? <Link
        href="/configuracion/suscripcion"
        className="mb-6 flex items-center gap-3 rounded-card border border-line bg-primary-light/60 dark:bg-primary/20 p-4 transition hover:border-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Gift size={16} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink">
          <strong>Programa de referidos:</strong> gana 1 mes de descuento del{' '}
          {referralProgram.descuentoPorcentaje}% por cada colega que se suscriba.
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary dark:text-accent-2">
          Ver mi enlace <ArrowRight size={14} />
        </span>
      </Link> : null}

      <TodayAgenda bookings={todayBookings} todayIso={todayIso} />

      {!metrics.hasAnyBookings ? (
        <EmptyState
          title="Sin datos"
          description="Parece que todavía no hay actividad. Cuando registres sesiones en la agenda, aquí verás tus ingresos, sesiones y pacientes del mes."
          action={
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Ir a la agenda <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
                <Coins size={16} /> Ingresos del mes
              </div>
              <MoneyLines totals={metrics.collectedThisMonth} fallbackCurrency={currency} />
              <MoneyDelta current={metrics.collectedThisMonth} previous={metrics.collectedPreviousMonth} />
            </Card>
            <Card>
              <div className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
                <Wallet size={16} /> Por cobrar del mes
              </div>
              <MoneyLines totals={metrics.pendingThisMonth} fallbackCurrency={currency} />
              <p className="mt-1 text-xs text-ink-soft">
                Acumulado total: {moneyLabel(metrics.pendingTotal, currency)}
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <CalendarCheck2 size={16} /> Sesiones del mes
              </div>
              <p className="mt-2 text-2xl font-bold text-ink">{metrics.sessions.total}</p>
              <Delta current={metrics.sessions.total} previous={metrics.sessionsPreviousMonthTotal} />
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <UserPlus size={16} /> Pacientes nuevos
              </div>
              <p className="mt-2 text-2xl font-bold text-ink">{metrics.newPatientsThisMonth}</p>
              <Delta
                current={metrics.newPatientsThisMonth}
                previous={metrics.newPatientsPreviousMonth}
              />
            </Card>
          </div>

          <Card className="mb-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">Sesiones de {monthLabel}</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-success-soft px-3 py-1 text-success">
                Completadas: {metrics.sessions.completed}
              </span>
              <span className="rounded-full bg-primary-light px-3 py-1 text-primary">
                Confirmadas: {metrics.sessions.confirmed}
              </span>
              <span className="rounded-full border border-line bg-bg px-3 py-1 text-ink-soft">
                Agendadas: {metrics.sessions.scheduled}
              </span>
              <span className="rounded-full bg-danger-soft px-3 py-1 text-danger">
                Canceladas: {metrics.sessions.cancelled}
              </span>
              <span className="rounded-full bg-warning-soft px-3 py-1 text-warning">
                Inasistencias: {metrics.sessions.noShow}
              </span>
              <span className="rounded-full border border-line bg-bg px-3 py-1 text-ink-soft">
                Reprogramadas: {metrics.sessions.rescheduled}
              </span>
            </div>
          </Card>

          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-bold text-ink">Histórico de los últimos 12 meses</h2>
            <HistoryChart history={metrics.history} defaultCurrency={currency} />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Wallet size={17} className="text-warning" />
                <h2 className="text-base font-bold text-ink">Por cobrar</h2>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-ink-soft">Del mes en curso</dt>
                  <dd className="text-right font-semibold text-ink">
                    {currencyLinesOrZero(metrics.pendingThisMonth, currency).map((line) => (
                      <p key={line.currency}>{money(line.amount, line.currency)}</p>
                    ))}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-ink-soft">Total acumulado</dt>
                  <dd className="text-right font-semibold text-ink">
                    {currencyLinesOrZero(metrics.pendingTotal, currency).map((line) => (
                      <p key={line.currency}>{money(line.amount, line.currency)}</p>
                    ))}
                  </dd>
                </div>
              </dl>
              <Link
                href="/pagos?estado=pendiente"
                className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
              >
                Ver pagos pendientes <ArrowRight size={14} />
              </Link>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <CreditCard size={17} className="text-primary dark:text-accent-2" />
                <h2 className="text-base font-bold text-ink">Métodos de pago del mes</h2>
              </div>
              {metrics.incomeByMethod.length === 0 ? (
                <p className="text-sm text-ink-soft">Aún no hay pagos registrados este mes.</p>
              ) : (
                <ul className="space-y-3">
                  {metrics.incomeByMethod.map((item) => (
                    <li key={`${item.method}-${item.currency}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wide text-ink-soft">
                          {PaymentMethod.labelFor(item.method) === '—'
                            ? item.method.toUpperCase()
                            : PaymentMethod.labelFor(item.method)}
                        </span>
                        <span className="text-ink">
                          {money(item.amount, item.currency)} ·{' '}
                          <span className="font-medium text-primary dark:text-accent-2">
                            {MX_PERCENT.format(item.percentage)} %
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, item.percentage)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Users size={17} className="text-success" />
                <h2 className="text-base font-bold text-ink">Pacientes del mes por género</h2>
              </div>
              {metrics.genderDistribution.length === 0 ? (
                <p className="text-sm text-ink-soft">Sin pacientes atendidos este mes.</p>
              ) : (
                <ul className="space-y-3">
                  {metrics.genderDistribution.map((item) => (
                    <li key={item.gender}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink-soft">{genderLabel(item.gender)}</span>
                        <span className="text-ink">
                          {item.count} ·{' '}
                          <span className="font-medium text-success">
                            {MX_PERCENT.format(item.percentage)} %
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${Math.max(2, item.percentage)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
