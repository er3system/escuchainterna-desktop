'use server';

import { revalidatePath } from 'next/cache';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { forbidAssistantRole } from '@/shared/infrastructure/auth/dataOwner';

export interface SubscriptionActionState {
  error?: string;
}

/**
 * Cancelación self-service «al fin de periodo»: el titular conserva acceso hasta el fin del
 * periodo ya pagado. El gate de rol corre FUERA del try para que un redirect (asistente) se
 * propague en vez de quedar atrapado como "error".
 */
export async function cancelSubscriptionAction(): Promise<SubscriptionActionState> {
  const userId = await forbidAssistantRole();
  try {
    await createIdentityUseCases().cancelSubscription.cancel(userId);
    revalidatePath('/configuracion/suscripcion');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo cancelar la suscripción.' };
  }
}

/** Reanuda una suscripción cancelada (antes de que termine el periodo): vuelve a renovarse. */
export async function resumeSubscriptionAction(): Promise<SubscriptionActionState> {
  const userId = await forbidAssistantRole();
  try {
    await createIdentityUseCases().resumeSubscription.resume(userId);
    revalidatePath('/configuracion/suscripcion');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo reanudar la suscripción.' };
  }
}
