'use server';

import { revalidatePath } from 'next/cache';
import type { PermissionPreset } from '@/contexts/identity/application/admin-save-permission-presets/AdminSavePermissionPresets';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { requireAdmin } from '../requireAdmin';

export interface SavePresetsResult {
  ok?: string;
  error?: string;
}

export async function savePermissionPresetsAction(presets: PermissionPreset[]): Promise<SavePresetsResult> {
  const admin = await requireAdmin();
  try {
    const saved = await createAdminUseCases().savePermissionPresets.save(admin.userId, presets);
    revalidatePath('/admin/roles');
    revalidatePath('/admin/cuentas');
    return {
      ok:
        saved.length === 1
          ? 'Se guardó 1 plantilla de permisos.'
          : `Se guardaron ${saved.length} plantillas de permisos.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudieron guardar las plantillas.' };
  }
}
