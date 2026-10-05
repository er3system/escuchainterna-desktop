'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { LoadPublicationCatalog } from '@/contexts/library/application/load-publication-catalog/LoadPublicationCatalog';
import { MarkPublicationReviewed } from '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewed';
import { MarkPublicationReviewedMessage } from '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewedMessage';
import { TogglePublicationFavorite } from '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavorite';
import { TogglePublicationFavoriteMessage } from '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavoriteMessage';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';

export async function reloadPublicationCatalogAction(): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  const result = await new LoadPublicationCatalog(new SqlitePublicationRepository(userId)).load();
  revalidatePath('/biblioteca');
  redirect(`/biblioteca?cargadas=${result.loaded}&actualizadas=${result.updated}`);
}

export interface ToggleFavoriteState {
  favorite?: boolean;
  error?: string;
}

/**
 * Sello "Revisada por el equipo clínico de EscuchaInterna" (v3 §8).
 * SOLO el admin de plataforma puede otorgarlo; para cualquier otro rol la
 * acción no hace nada (no revela siquiera que existe).
 */
export async function markPublicationReviewedAction(publicationId: string): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.role !== 'admin') return;

  await new MarkPublicationReviewed(new SqlitePublicationRepository(userId)).mark(
    new MarkPublicationReviewedMessage({ publicationId }),
  );
  revalidatePath('/biblioteca');
  revalidatePath(`/biblioteca/${publicationId}`);
}

export async function togglePublicationFavoriteAction(publicationId: string): Promise<ToggleFavoriteState> {
  const userId = await requireActiveAppSessionUserId();
  try {
    const message = new TogglePublicationFavoriteMessage({ publicationId });
    const result = await new TogglePublicationFavorite(
      new SqlitePublicationRepository(userId),
    ).toggle(message);
    revalidatePath('/biblioteca');
    revalidatePath(`/biblioteca/${publicationId}`);
    return { favorite: result.favorite };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar el favorito.' };
  }
}
