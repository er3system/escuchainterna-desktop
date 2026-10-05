import {
  parsePermissionPresets,
  PERMISSION_PRESETS_KEY,
} from '@/contexts/identity/application/admin-save-permission-presets/AdminSavePermissionPresets';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { AccountsTable } from './AccountsTable';
import { CreateUserPanel } from './CreateUserPanel';

export default async function AdminCuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdmin();
  const { q } = await searchParams;
  const useCases = createAdminUseCases();

  const accounts = await useCases.directory.listAccounts();
  const organizations = (await useCases.directory.listOrganizations()).map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));
  const presets = parsePermissionPresets(await useCases.settings.get(PERMISSION_PRESETS_KEY)).map((preset) => ({
    name: preset.name,
    permissions: { ...preset.permissions },
  }));

  return (
    <div>
      <PageHeader
        title="Cuentas"
        subtitle={`${accounts.length} cuentas en la plataforma — las creadas desde aquí no pagan suscripción`}
      />
      <CreateUserPanel organizations={organizations} presets={presets} />
      <AccountsTable accounts={accounts} currentAdminId={admin.userId} initialQuery={q ?? ''} />
    </div>
  );
}
