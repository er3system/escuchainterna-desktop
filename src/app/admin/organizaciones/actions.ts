'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminUpsertOrganizationMessage } from '@/contexts/identity/application/admin-upsert-organization/AdminUpsertOrganizationMessage';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { requireAdmin } from '../requireAdmin';
import { readPermissionsFromForm } from '../permissionsForm';

export interface OrganizationFormState {
  ok?: string;
  error?: string;
}

export async function upsertOrganizationAction(
  _prev: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const admin = await requireAdmin();
  const existingId = String(formData.get('organizacion_id') ?? '').trim() || null;
  let organizationId: string;
  try {
    const message = new AdminUpsertOrganizationMessage({
      actorUserId: admin.userId,
      organizationId: existingId,
      name: String(formData.get('nombre') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      kind: String(formData.get('tipo') ?? 'empresa'),
      masterUserId: String(formData.get('maestro') ?? '').trim() || null,
      defaultPermissions: readPermissionsFromForm(formData),
      freeService: formData.get('servicio_sin_costo') === 'on',
    });
    organizationId = await createAdminUseCases().upsertOrganization.upsert(message);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la organización.' };
  }

  revalidatePath('/admin/organizaciones');
  revalidatePath(`/admin/organizaciones/${organizationId}`);
  revalidatePath('/admin');
  if (!existingId) redirect(`/admin/organizaciones/${organizationId}`);
  return { ok: 'Organización guardada correctamente.' };
}
