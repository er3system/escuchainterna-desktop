'use server';

import { revalidatePath } from 'next/cache';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import { requireAdmin } from '../requireAdmin';

export interface ModerationResult {
  ok?: boolean;
  error?: string;
}

/**
 * Otorga o retira el sello "Revisada por el equipo clínico" desde el hub admin.
 * Gateado por requireAdmin y auditado. Refresca la cola admin y la biblioteca.
 */
export async function setPublicationReviewedAction(
  publicationId: string,
  reviewed: boolean,
): Promise<ModerationResult> {
  const admin = await requireAdmin();
  try {
    const repo = new SqlitePublicationRepository();
    const publication = await repo.findById(publicationId);
    if (!publication) return { error: 'Publicación no encontrada.' };

    if (reviewed) publication.markAsReviewed();
    else publication.unmarkAsReviewed();
    await repo.save(publication);

    await createAdminUseCases().audit.record({
      actorUserId: admin.userId,
      action: 'moderar_biblioteca',
      target: publication.toPrimitives().title,
      details: { publicationId, reviewed },
    });

    revalidatePath('/admin/biblioteca');
    revalidatePath('/biblioteca');
    revalidatePath(`/biblioteca/${publicationId}`);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar la publicación.' };
  }
}
