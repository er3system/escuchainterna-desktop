import { Building2 } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import {
  requireOrgMaster,
  getOrganization,
  listConsultorios,
  listInstitutionalPatients,
  listOrganizationMembers,
} from '../orgData';
import { ReassignControl } from './ReassignControl';
import { ConsultorioFilter } from './ConsultorioFilter';

/**
 * Expedientes de la organización (cuentas institucionales §1, §3.3): el maestro ve
 * los pacientes que pertenecen a la institución, su tratante actual y su supervisor,
 * y puede REASIGNAR el acceso (cambiar tratante o retener en la institución). Solo
 * metadatos de custodia — nunca contenido clínico.
 */
export default async function OrgExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ consultorio?: string }>;
}) {
  const { organization } = await requireOrgMaster();
  const current = (await getOrganization(organization.id)) ?? organization;
  const params = await searchParams;
  const consultorioFilter = (params.consultorio ?? '').trim() || undefined;

  if (current.patientOwnership !== 'institucion') {
    return (
      <div>
        <PageHeader
          title="Expedientes de la organización"
          subtitle="Reasigna el acceso a los expedientes que pertenecen a la institución."
        />
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
              <Building2 size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Esta organización no es dueña de los expedientes</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Actívalo en <span className="font-medium">Branding → Expedientes de la institución</span> para
                que los pacientes nuevos pertenezcan a la organización y puedas reasignar su acceso aquí.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const consultorios = await listConsultorios(organization.id);
  const patients = await listInstitutionalPatients(organization.id, consultorioFilter);
  const members = (await listOrganizationMembers(organization.id))
    .filter((member) => member.status === 'activo')
    .map((member) => ({ userId: member.userId, label: member.fullName || member.email }));
  // Solo se muestra la columna/el filtro de consultorio si la org usa consultorios.
  const usesConsultorios = consultorios.length > 0;
  const filtering = Boolean(consultorioFilter);

  return (
    <div>
      <PageHeader
        title="Expedientes de la organización"
        subtitle="Pacientes que pertenecen a la institución. Reasigna el tratante o retén el expediente en la organización; la continuidad se mantiene sobre el registro vivo, sin exportarlo."
      />

      {usesConsultorios ? (
        <div className="mb-4 flex items-center gap-3">
          <ConsultorioFilter consultorios={consultorios} current={consultorioFilter ?? ''} />
        </div>
      ) : null}

      {patients.length === 0 ? (
        <EmptyState
          title={filtering ? 'Sin expedientes en este consultorio' : 'Sin expedientes institucionales'}
          description={
            filtering
              ? 'Ningún paciente de la institución pertenece a este consultorio. Prueba con «Todos los consultorios».'
              : 'Cuando un miembro dé de alta un paciente, su expediente pertenecerá a la organización y aparecerá aquí.'
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-medium">Paciente</th>
                {usesConsultorios ? <th className="px-3 py-3 font-medium">Consultorio</th> : null}
                <th className="px-3 py-3 font-medium">Tratante actual</th>
                <th className="px-3 py-3 font-medium">Supervisor</th>
                <th className="px-3 py-3 font-medium">Reasignar</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.patientId} className="border-b border-line last:border-b-0 align-middle">
                  <td className="px-5 py-3 font-medium text-ink">{patient.patientName}</td>
                  {usesConsultorios ? (
                    <td className="px-3 py-3">
                      {patient.consultorioName ? (
                        <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                          {patient.consultorioName}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-3 text-ink">
                    {patient.heldByInstitution ? (
                      <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                        Retenido por la institución
                      </span>
                    ) : (
                      patient.tratanteName
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink-soft">{patient.supervisorName ?? '—'}</td>
                  <td className="px-3 py-3">
                    <ReassignControl
                      patientId={patient.patientId}
                      currentOwnerUserId={patient.ownerUserId}
                      heldByInstitution={patient.heldByInstitution}
                      members={members}
                    />
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
