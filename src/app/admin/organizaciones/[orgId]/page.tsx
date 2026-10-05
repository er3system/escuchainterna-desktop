import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { Badge, Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '../../requireAdmin';
import { OrganizationForm } from '../OrganizationForm';
import { organizationHasFreeService } from '../freeServiceData';

const MEMBER_ROLE_LABELS: Record<string, string> = {
  master: 'Maestro',
  professor: 'Professor',
  psychologist: 'Psicólogo/a',
};

function permissionBadges(permissionsJson: string): string[] {
  const permissions = MembershipPermissions.fromJson(permissionsJson);
  const badges: string[] = [];
  if (permissions.paymentsAreDisabled()) badges.push('Sin pagos');
  if (permissions.retention() > 0) badges.push(`Liquidación interna ${permissions.retention()}%`);
  if (permissions.mustUseAppPayments()) badges.push('Pago al agendar');
  if (permissions.canSupervise()) badges.push('Supervisa');
  if (!permissions.paymentsAreDisabled() && !permissions.canConfigurePayments()) {
    badges.push('No configura pagos');
  }
  return badges;
}

export default async function AdminOrganizacionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requireAdmin();
  const { orgId } = await params;
  const useCases = createAdminUseCases();

  const organization = await useCases.directory.findOrganization(orgId);
  if (!organization) notFound();

  const members = await useCases.directory.listOrganizationMembers(orgId);
  const masters = (await useCases.directory.listMasterCandidates()).map((candidate) => ({
    id: candidate.id,
    label: candidate.fullName ? `${candidate.fullName} (${candidate.email})` : candidate.email,
  }));

  const freeService = await organizationHasFreeService(organization.id);
  const formValues = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    kind: organization.kind,
    masterUserId: organization.masterUserId,
    freeService,
    defaultPolicies: MembershipPermissions.fromJson(organization.defaultMemberPoliciesJson).toPrimitives(),
  };

  return (
    <div>
      <PageHeader
        title={organization.name}
        subtitle={`${organization.slug} · ${organization.memberCount} ${organization.memberCount === 1 ? 'miembro' : 'miembros'}`}
        actions={
          <Link
            href="/admin/organizaciones"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft size={15} />
            Volver
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-ink">Editar organización</h2>
          <OrganizationForm organization={formValues} masters={masters} />
        </Card>

        <Card className="p-0">
          <h2 className="border-b border-line px-5 py-4 text-base font-semibold text-ink">Miembros</h2>
          {members.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">
              Esta organización aún no tiene miembros. Créalos desde{' '}
              <Link href="/admin/cuentas" className="font-medium text-primary dark:text-accent-2 hover:underline">
                Cuentas
              </Link>{' '}
              asignándoles esta organización.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-medium">Miembro</th>
                  <th className="px-3 py-3 font-medium">Rol</th>
                  <th className="px-3 py-3 font-medium">Permisos</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const badges = permissionBadges(member.permissionsJson);
                  return (
                    <tr key={member.userId} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{member.fullName || '—'}</p>
                        <p className="text-xs text-ink-soft">{member.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="primary">{MEMBER_ROLE_LABELS[member.memberRole] ?? member.memberRole}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        {badges.length === 0 ? (
                          <span className="text-xs text-ink-soft">Permisos estándar</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {badges.map((badge) => (
                              <Badge key={badge}>{badge}</Badge>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={member.status === 'activo' ? 'success' : 'danger'}>
                          {member.status === 'activo' ? 'Activo' : 'Suspendido'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
