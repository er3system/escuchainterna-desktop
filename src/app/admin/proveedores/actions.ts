'use server';

import { revalidatePath } from 'next/cache';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { requireAdmin } from '../requireAdmin';
import { PLATFORM_PROVIDERS } from './providersCatalog';

export interface ProviderFormState {
  ok?: string;
  error?: string;
}

export async function configureProviderAction(
  _prev: ProviderFormState,
  formData: FormData,
): Promise<ProviderFormState> {
  const admin = await requireAdmin();
  try {
    const providerId = String(formData.get('proveedor') ?? '');
    const spec = PLATFORM_PROVIDERS.find((provider) => provider.id === providerId);
    if (!spec) return { error: 'Proveedor desconocido.' };

    const config: Record<string, string> = {};
    for (const field of spec.fields) {
      config[field.key] = String(formData.get(`cfg_${field.key}`) ?? '');
    }

    const state = await createAdminUseCases().configureProvider.configure(admin.userId, providerId, config);
    revalidatePath('/admin/proveedores');
    return {
      ok:
        state.status === 'configurado'
          ? 'Credenciales guardadas: el proveedor queda marcado como configurado.'
          : 'Guardado sin credenciales: el proveedor queda en modo simulado.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar el proveedor.' };
  }
}
