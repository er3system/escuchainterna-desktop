'use server';

import { redirect } from 'next/navigation';
import { requireSessionUserId, destroySession } from '@/shared/infrastructure/auth/session';
import { SqliteUserAccountRepository } from '@/contexts/identity/infrastructure/persistence/SqliteUserAccountRepository';
import { ScryptPasswordHasher } from '@/contexts/identity/infrastructure/ScryptPasswordHasher';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  countClinicalData,
  isOrganizationMaster,
  purgeAccountData,
} from '@/shared/infrastructure/account-data/AccountDataPurge';

export interface DeleteAccountState {
  error?: string;
}

const CONFIRM_PHRASE = 'ELIMINAR MI CUENTA';

/**
 * Supresión de la PROPIA cuenta (habeas data, Ley 1581 — derecho de cancelación), en
 * autoservicio desde /configuracion/seguridad. Re-autentica con la contraseña y exige
 * una frase de confirmación, y respeta las MISMAS salvaguardas que el borrado del admin:
 *  - no se borra una cuenta de administración por esta vía;
 *  - no se borra una cuenta maestra de organización (primero transferir la organización);
 *  - no se borra una cuenta con datos clínicos bajo retención (primero exportar/transferir).
 * El purge + la traza confirman o revierten juntos; al terminar, cierra la sesión y vuelve
 * a la portada.
 */
export async function deleteOwnAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const userId = await requireSessionUserId();
  const password = String(formData.get('password') ?? '');
  const phrase = String(formData.get('confirmacion') ?? '');

  if (phrase.trim() !== CONFIRM_PHRASE) {
    return { error: `Para confirmar, escribe exactamente: ${CONFIRM_PHRASE}` };
  }

  const account = await new SqliteUserAccountRepository().findById(userId);
  if (!account) return { error: 'No se pudo verificar tu sesión. Vuelve a iniciar sesión.' };
  if (!new ScryptPasswordHasher().verify(password, account.storedPasswordHash())) {
    return { error: 'Contraseña incorrecta.' };
  }

  const row = (await getDatabaseAdapter().queryRow('SELECT email, role FROM users WHERE id = ?', [
    userId,
  ])) as { email: string; role: string } | null;
  if (!row) return { error: 'No se pudo verificar tu sesión. Vuelve a iniciar sesión.' };
  if (row.role === 'admin') {
    return { error: 'Una cuenta de administración no puede eliminarse por autoservicio.' };
  }
  if (await isOrganizationMaster(userId)) {
    return {
      error:
        'Tu cuenta es maestra de una organización. Transfiere o cierra la organización antes de eliminar tu cuenta.',
    };
  }

  const clinical = await countClinicalData(userId);
  if (clinical.total > 0) {
    return {
      error: `No puedes eliminar tu cuenta mientras conserve datos clínicos bajo retención legal (${clinical.patients} pacientes, ${clinical.records} historias, ${clinical.notes} notas de sesión, ${clinical.diagnoses} diagnósticos). Exporta tus datos o transfiere la custodia primero.`,
    };
  }

  try {
    await getDatabaseAdapter().transaction(async () => {
      await purgeAccountData(userId);
      await createAdminUseCases().audit.record({
        actorUserId: userId,
        action: 'eliminar_cuenta',
        target: row.email,
        details: { userId, autoservicio: true },
      });
    });
  } catch {
    return { error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' };
  }

  // Fuera del try: redirect() lanza una señal que Next maneja y no debe atraparse.
  await destroySession();
  redirect('/?cuenta=eliminada');
}
