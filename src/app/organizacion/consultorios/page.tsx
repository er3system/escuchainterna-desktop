import { Building2 } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireOrgMaster, getOrganization, listConsultorios, listOrganizationMembers } from '../orgData';
import { CreateConsultorioForm } from './CreateConsultorioForm';
import { ConsultorioModeControl } from './ConsultorioModeControl';

/**
 * Consultorios de la organización (sub-unidades opcionales, §2). Fase 1: solo
 * estructura — crear consultorios y ver cuántos miembros pertenecen a cada uno.
 * El aislamiento de datos clínicos entre consultorios llega en una fase posterior.
 */
export default async function ConsultoriosPage() {
  const { organization } = await requireOrgMaster();
  const current = (await getOrganization(organization.id)) ?? organization;
  const consultorios = await listConsultorios(organization.id);
  const members = await listOrganizationMembers(organization.id);

  const memberCount = (consultorioId: string) =>
    members.filter((member) => member.consultorioId === consultorioId).length;
  const sinConsultorio = members.filter(
    (member) => member.memberRole !== 'master' && member.consultorioId === null,
  ).length;

  return (
    <div>
      <PageHeader
        title="Consultorios"
        subtitle="Organiza a tu equipo en sub-unidades (sedes o grupos). Asigna el consultorio de cada miembro desde la pestaña Miembros. Por ahora solo se guarda la pertenencia."
      />

      <Card className="mb-6">
        <h2 className="mb-1 text-sm font-bold text-ink">Modo de los consultorios</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Elige cómo funcionan los consultorios en tu organización. Puedes cambiarlo cuando quieras.
        </p>
        <ConsultorioModeControl mode={current.consultorioMode} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {consultorios.length === 0 ? (
            <EmptyState
              title="Aún no hay consultorios"
              description="Crea el primer consultorio con el formulario de la derecha. Es opcional: sin consultorios, tu organización funciona igual que hoy."
            />
          ) : (
            <>
              {consultorios.map((consultorio) => (
                <div
                  key={consultorio.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 shadow-card"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={16} className="shrink-0 text-primary" />
                    <p className="truncate font-semibold text-ink">{consultorio.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                    {memberCount(consultorio.id)}{' '}
                    {memberCount(consultorio.id) === 1 ? 'miembro' : 'miembros'}
                  </span>
                </div>
              ))}
              {sinConsultorio > 0 ? (
                <p className="px-1 text-xs text-ink-soft">
                  {sinConsultorio}{' '}
                  {sinConsultorio === 1 ? 'miembro sin consultorio' : 'miembros sin consultorio'}.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-bold text-ink">Nuevo consultorio</h2>
            <CreateConsultorioForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
