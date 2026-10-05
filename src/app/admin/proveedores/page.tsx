import { Info } from 'lucide-react';
import {
  parseProvidersState,
  PLATFORM_PROVIDERS_KEY,
} from '@/contexts/identity/application/admin-configure-provider/AdminConfigureProvider';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { PLATFORM_PROVIDERS } from './providersCatalog';
import { ProviderCard, type ProviderCardData } from './ProviderCard';

export default async function AdminProveedoresPage() {
  await requireAdmin();
  const state = parseProvidersState(await createAdminUseCases().settings.get(PLATFORM_PROVIDERS_KEY));

  const providers: ProviderCardData[] = PLATFORM_PROVIDERS.map((spec) => {
    const providerState = state[spec.id];
    return {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      fields: spec.fields.map((field) => ({ ...field })),
      status: providerState?.status ?? 'simulado',
      config: providerState?.config ?? {},
      updatedAt: providerState?.updatedAt ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Proveedores de plataforma"
        subtitle="Servicios externos administrados centralmente — sin credenciales reales funcionan en modo simulado"
      />

      <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-primary-light/60 dark:bg-primary/20 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-primary dark:text-accent-2" />
        <p className="text-sm text-ink">
          Los psicólogos <strong>no</strong> configuran estos proveedores; los recordatorios de WhatsApp y los
          correos salen de la cuenta empresa de EscuchaInterna. Los profesionales solo conectan sus métodos de
          cobro personales en su propia configuración.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
