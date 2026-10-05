'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { addCompletedTutorial } from './helpProgress';

/** Marca un tutorial como completado para el usuario actual (idempotente). */
export async function markTutorialCompletedAction(tutorialId: string): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  await addCompletedTutorial(userId, tutorialId);
  revalidatePath('/ayuda');
}
