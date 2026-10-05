import { Card, EmptyState, PageHeader } from '@/components/ui';
import {
  requireOrgMaster,
  getOrganization,
  listOrganizationMembers,
  listConsultorios,
} from '../orgData';
import { CreateMemberForm } from './CreateMemberForm';
import { MemberCard } from './MemberCard';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function MiembrosPage() {
  const { organization } = await requireOrgMaster();
  const institutional =
    ((await getOrganization(organization.id)) ?? organization).patientOwnership === 'institucion';
  const members = await listOrganizationMembers(organization.id);
  const consultorios = await listConsultorios(organization.id);

  return (
    <div>
      <PageHeader
        title="Miembros del equipo"
        subtitle="Crea cuentas para tu equipo (la organización cubre su suscripción) y ajusta los permisos de cada miembro."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {members.length === 0 ? (
            <EmptyState
              title="Aún no hay miembros"
              description="Crea la primera cuenta del equipo con el formulario de la derecha."
            />
          ) : (
            members.map((member) => (
              <MemberCard
                key={member.userId}
                institutional={institutional}
                consultorios={consultorios}
                desktopEdition={isDesktopEdition()}
                member={{
                  userId: member.userId,
                  fullName: member.fullName,
                  email: member.email,
                  professionalLicense: member.professionalLicense,
                  memberRole: member.memberRole,
                  status: member.status,
                  permissions: member.permissions,
                  patientCount: member.patientCount,
                  consultorioId: member.consultorioId,
                  consultorioName: member.consultorioName,
                }}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-bold text-ink">Nueva cuenta de miembro</h2>
            <CreateMemberForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
