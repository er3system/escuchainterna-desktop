import { Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  RECORD_ACCESS_AREA_LABELS,
  searchRecordAccess,
} from '@/shared/infrastructure/audit/recordAccessLog';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { listOrganizationMembers, requireOrgMaster } from '../orgData';

const INPUT_CLASS =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light';

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/**
 * Bitácora de accesos a expedientes de la organización (v3 §1.2): el maestro
 * ve los accesos hechos POR sus miembros o SOBRE pacientes de sus miembros.
 * Solo metadatos (quién, qué área, cuándo) — nunca contenido clínico.
 */
export default async function OrgAccesosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organization } = await requireOrgMaster();
  const params = await searchParams;
  const filters = {
    patientQuery: single(params.paciente),
    actorQuery: single(params.actor),
    from: single(params.desde),
    to: single(params.hasta),
  };

  const members = await listOrganizationMembers(organization.id);
  const accesses = await searchRecordAccess({
    ...filters,
    memberUserIds: members.map((member) => member.userId),
  });

  return (
    <div>
      <PageHeader
        title="Accesos a expedientes"
        subtitle="Bitácora de tu equipo: quién abrió qué expediente y cuándo. Solo metadatos, nunca contenido clínico."
      />

      <Card className="mb-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-paciente">
              Paciente
            </label>
            <input
              id="filtro-paciente"
              type="text"
              name="paciente"
              defaultValue={filters.patientQuery}
              placeholder="Nombre del paciente…"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="filtro-actor">
              Miembro (correo o nombre)
            </label>
            <input
              id="filtro-actor"
              type="text"
              name="actor"
              defaultValue={filters.actorQuery}
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
          <Button type="submit">
            <Filter size={15} />
            Filtrar
          </Button>
        </form>
      </Card>

      {accesses.length === 0 ? (
        <EmptyState
          title="Sin accesos registrados"
          description="Cuando un miembro de tu equipo abra un expediente, el acceso aparecerá aquí."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium">Miembro</th>
                <th className="px-3 py-3 font-medium">Paciente</th>
                <th className="px-3 py-3 font-medium">Área</th>
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
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                        {RECORD_ACCESS_AREA_LABELS[access.area] ?? access.area}
                      </span>
                      {access.action === 'acceso_cobertura' ? (
                        <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                          Cobertura
                        </span>
                      ) : null}
                      {access.action === 'acceso_compartido' ? (
                        <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                          Compartido
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
