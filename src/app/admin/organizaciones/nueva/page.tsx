import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '../../requireAdmin';
import { OrganizationForm } from '../OrganizationForm';

export default async function NuevaOrganizacionPage() {
  await requireAdmin();
  const masters = (
    await createAdminUseCases().directory.listMasterCandidates()
  ).map((candidate) => ({
    id: candidate.id,
    label: candidate.fullName ? `${candidate.fullName} (${candidate.email})` : candidate.email,
  }));

  return (
    <div>
      <PageHeader
        title="Nueva organización"
        subtitle="Perfil maestro, slug y políticas por defecto para sus miembros"
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
      <Card className="max-w-3xl">
        <OrganizationForm organization={null} masters={masters} />
      </Card>
    </div>
  );
}
