import Link from 'next/link';
import { Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import {
  RECORD_ACCESS_AREA_LABELS,
  searchRecordAccess,
} from '@/shared/infrastructure/audit/recordAccessLog';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { AUDIT_ACTION_LABELS } from './auditActionLabels';

const INPUT_CLASS =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light';

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function prettyDetails(detailsJson: string): string {
  try {
    const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
    const pairs = Object.entries(parsed).filter(([, v]) => v !== null && v !== '' && v !== undefined);
    if (pairs.length === 0) return '';
    return pairs.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ');
  } catch {
    return detailsJson;
  }
}

const TAB_CLASS = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    active ? 'bg-primary-light text-primary' : 'text-ink-soft hover:bg-bg hover:text-ink'
  }`;

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tab = single(params.tab) === 'accesos' ? 'accesos' : 'acciones';
  const filters = {
    action: single(params.accion),
    actorEmail: single(params.actor),
    from: single(params.desde),
    to: single(params.hasta),
  };

  const tabNav = (
    <nav className="mb-4 flex flex-wrap gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
      <Link href="/admin/auditoria" className={TAB_CLASS(tab === 'acciones')}>
        Acciones de administración
      </Link>
      <Link href="/admin/auditoria?tab=accesos" className={TAB_CLASS(tab === 'accesos')}>
        Accesos a expedientes
      </Link>
    </nav>
  );

  if (tab === 'accesos') {
    const accessFilters = {
      patientQuery: single(params.paciente),
      actorQuery: filters.actorEmail,
      from: filters.from,
      to: filters.to,
    };
    const accesses = await searchRecordAccess(accessFilters);

    return (
      <div>
        <PageHeader
          title="Auditoría"
          subtitle="Bitácora de accesos a expedientes clínicos (record_access_log): quién vio qué y cuándo"
        />
        {tabNav}

        <Card className="mb-4">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="accesos" />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-paciente">
                Paciente
              </label>
              <input
                id="filtro-paciente"
                type="text"
                name="paciente"
                defaultValue={accessFilters.patientQuery}
                placeholder="Nombre del paciente…"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-actor">
                Actor (correo o nombre)
              </label>
              <input
                id="filtro-actor"
                type="text"
                name="actor"
                defaultValue={accessFilters.actorQuery}
                placeholder="correo@…"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-desde">
                Desde
              </label>
              <input id="filtro-desde" type="date" name="desde" defaultValue={accessFilters.from} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-hasta">
                Hasta
              </label>
              <input id="filtro-hasta" type="date" name="hasta" defaultValue={accessFilters.to} className={INPUT_CLASS} />
            </div>
            <Button type="submit">
              <Filter size={15} />
              Filtrar
            </Button>
          </form>
        </Card>

        {accesses.length === 0 ? (
          <EmptyState
            title="Sin accesos registrados"
            description="No hay accesos a expedientes que coincidan con los filtros."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Actor</th>
                  <th className="px-3 py-3 font-medium">Paciente</th>
                  <th className="px-3 py-3 font-medium">Área</th>
                  <th className="px-3 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map((access) => (
                  <tr key={access.id} className="border-b border-line last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                      {format(new Date(access.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                    </td>
                    <td className="px-3 py-3 text-ink">
                      {access.actorName || access.actorEmail || access.actorUserId}
                    </td>
                    <td className="px-3 py-3 text-ink">{access.patientName || access.patientId}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                        {RECORD_ACCESS_AREA_LABELS[access.area] ?? access.area}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{access.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    );
  }

  const audit = createAdminUseCases().audit;
  const entries = await audit.search(filters);
  const actions = await audit.distinctActions();

  return (
    <div>
      <PageHeader
        title="Auditoría"
        subtitle="Toda acción del hub de administración queda registrada en admin_audit_log"
      />
      {tabNav}

      <Card className="mb-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-accion">
              Acción
            </label>
            <select id="filtro-accion" name="accion" defaultValue={filters.action} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-actor">
              Correo del actor
            </label>
            <input
              id="filtro-actor"
              type="text"
              name="actor"
              defaultValue={filters.actorEmail}
              placeholder="correo@…"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-desde">
              Desde
            </label>
            <input id="filtro-desde" type="date" name="desde" defaultValue={filters.from} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-hasta">
              Hasta
            </label>
            <input id="filtro-hasta" type="date" name="hasta" defaultValue={filters.to} className={INPUT_CLASS} />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Filter size={15} />
            Filtrar
          </button>
        </form>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="Sin acciones registradas"
          description="No hay registros de auditoría que coincidan con los filtros."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium">Actor</th>
                <th className="px-3 py-3 font-medium">Acción</th>
                <th className="px-3 py-3 font-medium">Objetivo</th>
                <th className="px-3 py-3 font-medium">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line last:border-b-0 align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                    {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  <td className="px-3 py-3 text-ink">{entry.actorEmail || entry.actorUserId}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink">{entry.target || '—'}</td>
                  <td className="max-w-md px-3 py-3 text-xs text-ink-soft">{prettyDetails(entry.detailsJson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
