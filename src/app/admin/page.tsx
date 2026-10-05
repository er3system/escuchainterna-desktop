import Link from 'next/link';
import {
  Building2,
  CalendarCheck2,
  CreditCard,
  Database,
  HeartHandshake,
  Hourglass,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { getAiMonthSpend } from '@/shared/infrastructure/ai-billing/AiSpendDashboard';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from './requireAdmin';
import { RegistrationsChart } from './RegistrationsChart';
import { AUDIT_ACTION_LABELS } from './auditoria/auditActionLabels';

const MX_NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
        {detail ? <p className="text-xs text-ink-soft">{detail}</p> : null}
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-card transition hover:shadow-elev-md">
        <Card className="flex items-center gap-4">{inner}</Card>
      </Link>
    );
  }
  return <Card className="flex items-center gap-4">{inner}</Card>;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const dashboard = await createAdminUseCases().getDashboard.get();
  const gastoIa = await getAiMonthSpend();

  return (
    <div>
      <PageHeader
        title="Dashboard de la plataforma"
        subtitle="Agregados globales — por privacidad, nunca se muestra contenido clínico"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Usuarios"
          value={MX_NUMBER.format(dashboard.users.total)}
          detail={`${dashboard.users.active} activos · ${dashboard.users.suspended} suspendidos`}
          href="/admin/cuentas"
        />
        <StatCard
          icon={Hourglass}
          label="Trials activos"
          value={MX_NUMBER.format(dashboard.trials.active)}
          detail={`${dashboard.trials.expiringSoon} por vencer en 7 días`}
          href="/admin/cuentas"
        />
        <StatCard
          icon={CreditCard}
          label="Suscripciones activas"
          value={MX_NUMBER.format(dashboard.subscriptions.active)}
          detail={`MRR simulado: ${formatMoneyWithCode(dashboard.subscriptions.mrr, 'COP')}`}
          href="/admin/cuentas"
        />
        <StatCard
          icon={Building2}
          label="Organizaciones"
          value={MX_NUMBER.format(dashboard.organizations)}
          href="/admin/organizaciones"
        />
        <StatCard icon={HeartHandshake} label="Pacientes en la plataforma" value={MX_NUMBER.format(dashboard.totals.patients)} />
        <StatCard icon={CalendarCheck2} label="Sesiones agendadas" value={MX_NUMBER.format(dashboard.totals.bookings)} />
        <StatCard icon={MessageSquare} label="Mensajes enviados" value={MX_NUMBER.format(dashboard.totals.outboxMessages)} />
        <StatCard icon={Database} label="Tamaño de la base de datos" value={formatBytes(dashboard.databaseSizeBytes)} />
        <StatCard
          icon={Sparkles}
          label="Gasto IA del mes (estimado)"
          value={formatMoneyWithCode(gastoIa.totalCop, 'COP')}
          detail={`${MX_NUMBER.format(gastoIa.events)} interacciones de IA`}
        />
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-ink">Top 5 usuarios por gasto de IA — mes en curso</h2>
        {gastoIa.topUsers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Aún no hay uso de IA registrado este mes.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-4 font-medium">Correo</th>
                <th className="py-2 pr-4 text-right font-medium">Gasto estimado</th>
                <th className="py-2 text-right font-medium">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {gastoIa.topUsers.map((user) => (
                <tr key={user.email}>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/cuentas?q=${encodeURIComponent(user.email)}`}
                      className="text-primary hover:underline dark:text-accent-2"
                    >
                      {user.email}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right font-medium text-ink">
                    {formatMoneyWithCode(user.spentCop, 'COP')}
                  </td>
                  <td className="py-2 text-right text-ink-soft">{MX_NUMBER.format(user.events)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="mb-3 text-base font-semibold text-ink">Registros — últimos 30 días</h2>
          <RegistrationsChart points={dashboard.registrationsLast30Days} />
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Últimas acciones de administración</h2>
            <Link href="/admin/auditoria" className="text-sm font-medium text-primary hover:underline dark:text-accent-2">
              Ver auditoría
            </Link>
          </div>
          {dashboard.recentAuditEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Aún no hay acciones registradas.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dashboard.recentAuditEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                    <ShieldCheck size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      {entry.target ? <span className="font-normal text-ink-soft"> — {entry.target}</span> : null}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {entry.actorEmail || entry.actorUserId} ·{' '}
                      {format(new Date(entry.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
