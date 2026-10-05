'use server';

import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import {
  bumpSessionEpoch,
  createSession,
  requireSessionUserId,
} from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

/**
 * Cambia la contraseña del usuario autenticado (autoservicio, /configuracion/seguridad).
 * Tras el cambio invalida las DEMÁS sesiones (bump de epoch, SEG-4) y re-firma ESTA para no
 * cerrar la sesión actual del usuario que acaba de cambiarla.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const userId = await requireSessionUserId();
  const current = String(formData.get('actual') ?? '');
  const next = String(formData.get('nueva') ?? '');
  const confirmation = String(formData.get('confirmacion') ?? '');
  if (next !== confirmation) return { error: 'La contraseña nueva y su confirmación no coinciden.' };
  try {
    await getDatabaseAdapter().transaction(async () => {
      await createIdentityUseCases().changePassword.change(userId, current, next);
      // El hash nuevo y la invalidación de sesiones deben confirmar o revertir juntos.
      await bumpSessionEpoch(userId);
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.' };
  }
  // La cookie no forma parte de la transacción de BD. Si falla, el cambio sí quedó
  // confirmado y la sesión anterior ya no es válida; el mensaje debe decirlo con precisión.
  try {
    await createSession(userId);
  } catch {
    return {
      error:
        'La contraseña se cambió y las demás sesiones se cerraron, pero no pudimos renovar esta sesión. Vuelve a iniciar sesión.',
    };
  }
  return { ok: true };
}
