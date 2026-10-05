import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireOrgMaster, listOrganizationMembers, listOrgSupervisionLinks } from '../orgData';
import { CreateLinkForm, type SelectableMember } from './CreateLinkForm';
import { DeleteLinkButton } from './DeleteLinkButton';

export default async function OrgSupervisionPage() {
  const { organization } = await requireOrgMaster();
  const members = await listOrganizationMembers(organization.id);
  const links = await listOrgSupervisionLinks(organization.id);

  const selectable: SelectableMember[] = members
    .filter((member) => member.memberRole !== 'master')
    .map((member) => ({
      userId: member.userId,
      label: `${member.fullName || member.email} (${
        member.memberRole === 'professor' ? 'Profesor/a' : 'Psicólogo/a'
      })`,
      canSupervise: member.memberRole === 'professor' || member.permissions.canSupervisePatients,
    }));

  return (
    <div>
      <PageHeader
        title="Vínculos de supervisión"
        subtitle="Define quién supervisa a quién y con qué alcance. La vista de supervisión es siempre de solo lectura."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {links.length === 0 ? (
            <EmptyState
              title="Sin vínculos de supervisión"
              description="Crea el primer vínculo profesor → supervisado con el formulario de la derecha."
            />
          ) : (
            links.map((link) => (
              <Card key={link.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                      <Eye size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {link.supervisorName} <span className="font-normal text-ink-soft">supervisa a</span>{' '}
                        {link.supervisedName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {link.scope.notas ? <Badge tone="primary">Notas</Badge> : null}
                        {link.scope.historias ? <Badge tone="primary">Historias</Badge> : null}
                        {link.scope.pagos ? <Badge tone="warning">Pagos</Badge> : null}
                        <span className="text-xs text-ink-soft">
                          Desde el {format(new Date(link.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DeleteLinkButton
                    linkId={link.id}
                    description={`${link.supervisorName} → ${link.supervisedName}`}
                  />
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-bold text-ink">Nuevo vínculo</h2>
            <CreateLinkForm members={selectable} />
          </Card>
        </div>
      </div>
    </div>
  );
}
