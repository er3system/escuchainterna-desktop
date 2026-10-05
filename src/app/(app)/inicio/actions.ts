'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { SqliteUserPreferencesRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteUserPreferencesRepository';
import { ONBOARDING_DISMISSED_KEY } from './onboarding';

/** Oculta para siempre el checklist de primeros pasos del inicio. */
export async function dismissOnboardingAction(): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  await new SqliteUserPreferencesRepository(userId).set(ONBOARDING_DISMISSED_KEY, '1');
  revalidatePath('/inicio');
}
