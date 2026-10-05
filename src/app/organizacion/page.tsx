import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users,
  UserCheck,
  HeartHandshake,
  CalendarCheck2,
  FileSignature,
  Wallet,
  Percent,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  HandHeart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { Card, PageHeader } from '@/components/ui';
import { requireOrgMaster, listOrganizationMembers } from './orgData';
import { OrgActivityChart } from './OrgActivityChart';
import { OrgMemberSessionsChart } from './OrgMemberSessionsChart';
import { OrgSessionStatusChart } from './OrgSessionStatusChart';
import { OrgSupervisionChart } from './OrgSupervisionChart';

const CO_NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Tendencia vs mes anterior: relativa (conteos/dinero) o en puntos (tasas %). */
function Trend({
  current,
  previous,
  mode = 'relative',
}: {
  current: number | null;
  previous: number | null;
  mode?: 'relative' | 'points';
}) {
  if (current === null || previous === null) {
    return <p className="mt-1 text-xs text-ink-soft">Sin comparativo del mes anterior</p>;
  }

  let icon: LucideIcon = Minus;
  let toneClass = 'text-ink-soft';
  let label = 'Sin cambios';

  if (mode === 'points') {
    const delta = current - previous;
    if (Math.abs(delta) >= 0.5) {
      icon = delta > 0 ? TrendingUp : TrendingDown;
      toneClass = delta > 0 ? 'text-success' : 'text-danger';
      label = `${delta > 0 ? '+' : '−'}${CO_NUMBER.format(Math.abs(delta))} pts`;
    }
  } else if (previous === 0) {
    if (current > 0) {
      icon = TrendingUp;
      toneClass = 'text-success';
      label = 'Nuevo este mes';
    }
  } else {
    const delta = ((current - previous) / previous) * 100;
    if (Math.abs(delta) >= 0.5) {
      icon = delta > 0 ? TrendingUp : TrendingDown;
      toneClass = delta > 0 ? 'text-success' : 'text-danger';
      label = `${delta > 0 ? '+' : '−'}${CO_NUMBER.format(Math.abs(delta))}%`;
    }
  }

  const Icon = icon;
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${toneClass}`}>
      <Icon size={13} />
      {label}
      <span className="font-normal text-ink-soft">vs mes anterior</span>
    </p>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">{value}</p>
          {children}
        </div>
      </div>
    </Card>
  );
}

/** Carcasa de gráfica: título, subtítulo de una línea y estado vacío amable. */
function ChartCard({
  title,
  subtitle,
  empty,
  emptyMessage,
  className = '',
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyMessage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <p className="mb-3 text-xs text-ink-soft">{subtitle}</p>
      {empty ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-bg px-6 text-center">
          <p className="max-w-xs text-sm text-ink-soft">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

export default async function OrganizacionDashboardPage() {
  const { organization } = await requireOrgMaster();
  const insights = await createIdentityUseCases().getOrganizationInsights.get(organization.id);
  const members = await listOrganizationMembers(organization.id);
  const kindLabel =
    organization.kind === 'universidad'
      ? 'Universidad'
      : organization.kind === 'clinica'
        ? 'Clínica'
        : 'Empresa';
  const monthLabel = format(new Date(), "MMMM 'de' yyyy", { locale: es });

  const status = insights.sessionStatus;
  const statusEmpty =
    status.completadas + status.agendadas + status.canceladas + status.inasistencias === 0;
  const activityEmpty = insights.activityLast12Months.every((point) => point.sessions === 0);
  const supervisionEmpty = insights.supervisionActivity.every(
    (point) => point.notesWritten === 0 && point.notesReviewed === 0,
  );

  return (
    <div>
      <PageHeader
        title={organization.name}
        subtitle={`${kindLabel} · Qué pasa en tu organización este mes — solo números agregados, sin contenido clínico.`}
        actions={
          <Link
            href="/organizacion/miembros"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Gestionar miembros <ArrowRight size={16} />
          </Link>
        }
      />

      {/* ---------------- KPIs del mes con tendencia ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={Users} label="Miembros activos" value={String(insights.activeMembers.current)}>
          <Trend current={insights.activeMembers.current} previous={insights.activeMembers.previous} />
        </Kpi>
        <Kpi
          icon={HeartHandshake}
          label="Pacientes del equipo"
          value={String(insights.teamPatients.current)}
        >
          <Trend current={insights.teamPatients.current} previous={insights.teamPatients.previous} />
        </Kpi>
        <Kpi
          icon={CalendarCheck2}
          label="Sesiones realizadas"
          value={String(insights.sessionsHeld.current)}
        >
          <Trend current={insights.sessionsHeld.current} previous={insights.sessionsHeld.previous} />
        </Kpi>
        <Kpi
          icon={Percent}
          label="Asistencia del mes"
          value={
            insights.attendanceRate.current === null
              ? '—'
              : `${CO_NUMBER.format(insights.attendanceRate.current)}%`
          }
        >
          {insights.attendanceRate.current === null ? (
            <p className="mt-1 text-xs text-ink-soft">Aún sin sesiones concluidas este mes</p>
          ) : (
            <Trend
              current={insights.attendanceRate.current}
              previous={insights.attendanceRate.previous}
              mode="points"
            />
          )}
        </Kpi>
        <Kpi
          icon={FileSignature}
          label="Consentimientos firmados"
          value={
            insights.consentRate.current === null
              ? '—'
              : `${CO_NUMBER.format(insights.consentRate.current)}%`
          }
        >
          <p className="mt-1 text-xs text-ink-soft">
            {insights.patientsWithConsent} de {insights.teamPatients.current} pacientes con firma
          </p>
        </Kpi>
        {organization.freeService ? (
          <Kpi
            icon={HandHeart}
            label="Consultas sin costo"
            value={`${insights.sessionsHeld.current} ${
              insights.sessionsHeld.current === 1 ? 'sesión brindada' : 'sesiones brindadas'
            }`}
          >
            <p className="mt-1 text-xs text-ink-soft">Servicio gratuito para los pacientes del equipo.</p>
          </Kpi>
        ) : (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Wallet size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Ingresos del mes
                </p>
                {insights.incomeByCurrency.length === 0 ? (
                  <>
                    <p className="mt-0.5 text-2xl font-bold text-ink">—</p>
                    <p className="mt-1 text-xs text-ink-soft">Sin cobros registrados este mes</p>
                  </>
                ) : (
                  <ul className="mt-0.5 space-y-1">
                    {insights.incomeByCurrency.map((income) => (
                      <li key={income.currency}>
                        <p className="text-lg font-bold leading-snug text-ink">
                          {formatMoneyWithCode(income.current, income.currency)}
                        </p>
                        <Trend current={income.current} previous={income.previous} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ---------------- Gráficas del equipo ---------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Actividad de los últimos 12 meses"
          subtitle="Sesiones del equipo por mes: agendadas y efectivamente completadas."
          empty={activityEmpty}
          emptyMessage="Cuando el equipo empiece a agendar sesiones, aquí verás la evolución mensual de la actividad."
        >
          <OrgActivityChart points={insights.activityLast12Months} />
        </ChartCard>
        <ChartCard
          title="Estados de sesión del mes"
          subtitle={`Distribución de las sesiones de ${monthLabel}.`}
          empty={statusEmpty}
          emptyMessage="Este mes aún no hay sesiones registradas. La distribución aparecerá con la primera reserva."
        >
          <OrgSessionStatusChart breakdown={status} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Sesiones por miembro"
          subtitle={`Sesiones de ${monthLabel} por profesional (sin canceladas).`}
          empty={insights.sessionsByMember.length === 0}
          emptyMessage="Ningún miembro tiene sesiones este mes todavía. En cuanto agenden, verás la comparación aquí."
        >
          <OrgMemberSessionsChart points={insights.sessionsByMember} />
        </ChartCard>
        <ChartCard
          title="Actividad de supervisión"
          subtitle="Notas escritas por el equipo vs notas revisadas por supervisores, por mes."
          empty={supervisionEmpty}
          emptyMessage="Aún no hay notas ni revisiones de supervisión. Cuando los supervisores revisen notas de sus supervisados, la actividad aparecerá aquí."
        >
          <OrgSupervisionChart points={insights.supervisionActivity} />
        </ChartCard>
      </div>

      {/* ---------------- Equipo ---------------- */}
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Equipo</h2>
          <Link href="/organizacion/miembros" className="text-sm font-medium text-primary dark:text-accent-2 hover:underline">
            Ver todos
          </Link>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Aún no hay miembros. Crea las primeras cuentas desde la pestaña Miembros.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {members.slice(0, 6).map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                    <UserCheck size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {member.fullName || member.email}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{member.email}</p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-ink-soft">
                  {member.memberRole === 'master'
                    ? 'Perfil maestro'
                    : member.memberRole === 'professor'
                      ? 'Profesor/a'
                      : 'Psicólogo/a'}{' '}
                  · {member.patientCount} pacientes
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
