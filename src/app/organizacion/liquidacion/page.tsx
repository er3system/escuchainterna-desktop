import Link from 'next/link';
import { format, addMonths, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calculator, ChevronLeft, ChevronRight, Download, Info } from 'lucide-react';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import { Button, Card, PageHeader } from '@/components/ui';
import { requireOrgMaster, getOrgLiquidation, getOrganization } from '../orgData';

/**
 * Liquidación interna INFORMATIVA (v3 §3): sesiones cobradas por miembro en
 * el mes, total por moneda y el monto que correspondería a la organización
 * según el porcentaje de liquidación interna configurado por miembro.
 * No mueve dinero: es un reporte para los acuerdos org ↔ profesional.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeMonth(raw: string | undefined): string {
  return raw && MONTH_PATTERN.test(raw) ? raw : format(new Date(), 'yyyy-MM');
}

function shiftMonth(month: string, delta: number): string {
  return format(addMonths(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), delta), 'yyyy-MM');
}

const ROLE_LABELS: Record<string, string> = {
  master: 'Perfil maestro',
  professor: 'Profesor/a',
  psychologist: 'Psicólogo/a',
};

export default async function LiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { organization } = await requireOrgMaster();
  const { mes } = await searchParams;
  const month = normalizeMonth(mes);
  const liquidation = await getOrgLiquidation(organization.id, month);
  const freeService = ((await getOrganization(organization.id)) ?? organization).freeService;

  const monthLabel = format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy', {
    locale: es,
  });
  const hasActivity = liquidation.totalsByCurrency.length > 0;

  return (
    <div>
      <PageHeader
        title="Liquidación interna"
        subtitle="Reporte informativo del mes: cuánto cobró cada miembro y qué porcentaje de liquidación interna correspondería a la organización. No mueve dinero."
        actions={
          hasActivity ? (
            <a
              href={`/organizacion/liquidacion/csv?mes=${month}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <Download size={15} />
              Exportar CSV
            </a>
          ) : null
        }
      />

      {/* Selector de mes */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/organizacion/liquidacion?mes=${shiftMonth(month, -1)}`}
          aria-label="Mes anterior"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-bg"
        >
          <ChevronLeft size={16} />
        </Link>
        <span className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold capitalize text-ink">
          {monthLabel}
        </span>
        <Link
          href={`/organizacion/liquidacion?mes=${shiftMonth(month, 1)}`}
          aria-label="Mes siguiente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-bg"
        >
          <ChevronRight size={16} />
        </Link>
        <form method="GET" className="ml-1 flex items-center gap-2">
          <label htmlFor="mes" className="text-xs font-medium text-ink-soft">
            Ir a:
          </label>
          <input
            id="mes"
            type="month"
            name="mes"
            defaultValue={month}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
          />
          <Button type="submit" variant="outline" size="sm" className="text-sm">
            Ver
          </Button>
        </form>
      </div>

      {freeService ? (
        <div className="mb-5 flex items-start gap-2 rounded-card border border-line bg-primary-light p-4 text-sm text-ink">
          <Info size={16} className="mt-0.5 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Servicio sin costo activo:</span> las consultas del
            equipo son gratuitas para los pacientes, así que este reporte normalmente quedará en
            ceros. Se conserva para meses anteriores o acuerdos internos.
          </p>
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3">Miembro</th>
              <th className="px-3 py-3">Sesiones cobradas</th>
              <th className="px-3 py-3">Total cobrado</th>
              <th className="px-3 py-3">% liquidación interna (informativo)</th>
              <th className="px-3 py-3">Corresponde a la organización</th>
            </tr>
          </thead>
          <tbody>
            {liquidation.members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-soft">
                  <Calculator size={28} className="mx-auto mb-2 text-ink-soft" />
                  Aún no hay miembros en la organización.
                </td>
              </tr>
            ) : (
              liquidation.members.map((member) => (
                <tr key={member.userId} className="border-b border-line align-top last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{member.fullName || member.email}</p>
                    <p className="text-xs text-ink-soft">
                      {ROLE_LABELS[member.memberRole] ?? member.memberRole} · {member.email}
                    </p>
                  </td>
                  {member.totals.length === 0 ? (
                    <>
                      <td className="px-3 py-3 text-ink-soft">—</td>
                      <td className="px-3 py-3 text-ink-soft">—</td>
                      <td className="px-3 py-3 text-ink">{member.liquidationPercent}%</td>
                      <td className="px-3 py-3 text-ink-soft">—</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-ink">
                        {member.totals.map((total) => (
                          <p key={total.currency}>{total.paidSessions}</p>
                        ))}
                      </td>
                      <td className="px-3 py-3 font-medium text-ink">
                        {member.totals.map((total) => (
                          <p key={total.currency}>{formatMoneyWithCode(total.totalCharged, total.currency)}</p>
                        ))}
                      </td>
                      <td className="px-3 py-3 text-ink">{member.liquidationPercent}%</td>
                      <td className="px-3 py-3 font-semibold text-ink">
                        {member.totals.map((total) => (
                          <p key={total.currency}>
                            {formatMoneyWithCode(total.organizationShare, total.currency)}
                          </p>
                        ))}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {hasActivity ? (
            <tfoot>
              <tr className="border-t-2 border-line bg-bg font-semibold text-ink">
                <td className="px-5 py-3">Total del equipo</td>
                <td className="px-3 py-3">
                  {liquidation.totalsByCurrency.map((total) => (
                    <p key={total.currency}>{total.paidSessions}</p>
                  ))}
                </td>
                <td className="px-3 py-3">
                  {liquidation.totalsByCurrency.map((total) => (
                    <p key={total.currency}>{formatMoneyWithCode(total.totalCharged, total.currency)}</p>
                  ))}
                </td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3">
                  {liquidation.totalsByCurrency.map((total) => (
                    <p key={total.currency}>{formatMoneyWithCode(total.organizationShare, total.currency)}</p>
                  ))}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
        {!hasActivity && liquidation.members.length > 0 ? (
          <p className="border-t border-line px-5 py-4 text-center text-sm text-ink-soft">
            Sin cobros registrados en {monthLabel}.
          </p>
        ) : null}
      </Card>

      <p className="mt-4 text-xs text-ink-soft">
        El porcentaje de liquidación interna se configura por miembro en la pestaña Miembros y es
        solo informativo: la relación económica entre la organización y cada profesional se
        resuelve fuera de la plataforma.
      </p>
    </div>
  );
}
