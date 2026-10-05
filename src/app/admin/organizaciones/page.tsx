import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';

const KIND_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  universidad: 'Universidad',
  clinica: 'Clínica',
};

export default async function AdminOrganizacionesPage() {
  await requireAdmin();
  const organizations = await createAdminUseCases().directory.listOrganizations();

  return (
    <div>
      <PageHeader
        title="Organizaciones"
        subtitle="Empresas, universidades y clínicas con perfiles maestros"
        actions={
          <Link
            href="/admin/organizaciones/nueva"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Plus size={16} />
            Nueva organización
          </Link>
        }
      />

      {organizations.length === 0 ? (
        <EmptyState
          title="Aún no hay organizaciones"
          description="Crea la primera organización para agrupar perfiles de psicólogos bajo un perfil maestro."
          action={
            <Link
              href="/admin/organizaciones/nueva"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <Plus size={16} />
              Nueva organización
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-medium">Organización</th>
                <th className="px-3 py-3 font-medium">Slug</th>
                <th className="px-3 py-3 font-medium">Tipo</th>
                <th className="px-3 py-3 font-medium">Maestro</th>
                <th className="px-3 py-3 font-medium">Miembros</th>
                <th className="px-3 py-3 font-medium">Creada</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <Building2 size={15} className="text-primary dark:text-accent-2" />
                      {organization.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-soft">{organization.slug}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                      {KIND_LABELS[organization.kind] ?? organization.kind}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-soft">
                    {organization.masterName || organization.masterEmail || '—'}
                  </td>
                  <td className="px-3 py-3 text-ink">{organization.memberCount}</td>
                  <td className="px-3 py-3 text-ink-soft">
                    {format(new Date(organization.createdAt), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/admin/organizaciones/${organization.id}`}
                      className="text-xs font-medium text-primary dark:text-accent-2 hover:underline"
                    >
                      Gestionar
                    </Link>
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
