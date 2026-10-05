import { randomUUID } from 'node:crypto';
import type { SupervisionReviewPrimitives } from '../../domain/SupervisionReview';
import type { SupervisionReviewNotifier } from '../../domain/SupervisionReviewNotifier';
import type { SupervisionAccessReader } from '../../domain/repositories/SupervisionAccessReader';
import type { SupervisionReviewRepository } from '../../domain/repositories/SupervisionReviewRepository';
import { SupervisionLinkRequiredError } from '../../domain/errors/SupervisionLinkRequiredError';
import { SaveSupervisionReviewMessage } from './SaveSupervisionReviewMessage';

/**
 * Retroalimentación académica del supervisor sobre una nota del supervisado
 * (v3.2): upsert del comentario y/o de la marca "revisada".
 *
 * Reglas:
 * - SOLO con vínculo de supervisión vigente supervisor → dueño de la nota,
 *   con alcance de notas (lo resuelve el reader de forma estructural).
 * - El comentario se cifra at-rest (lo hace el repositorio al persistir).
 * - El supervisado recibe una notificación in-app cuando hay algo nuevo:
 *   comentario nuevo/actualizado o nota recién marcada como revisada.
 */
export class SaveSupervisionReview {
  public constructor(
    private readonly access: SupervisionAccessReader,
    private readonly reviews: SupervisionReviewRepository,
    private readonly notifier: SupervisionReviewNotifier,
  ) {}

  public async save(message: SaveSupervisionReviewMessage): Promise<SupervisionReviewPrimitives> {
    const note = await this.access.findReviewableNote(message.sessionNoteId(), message.supervisorUserId());
    if (!note) throw new SupervisionLinkRequiredError();

    const existing = await this.reviews.findByNoteAndSupervisor(
      message.sessionNoteId(),
      message.supervisorUserId(),
    );
    const now = new Date().toISOString();
    const review: SupervisionReviewPrimitives = {
      id: existing?.id ?? randomUUID(),
      sessionNoteId: message.sessionNoteId(),
      supervisorUserId: message.supervisorUserId(),
      supervisedUserId: note.supervisedUserId,
      comment: message.comment() ?? existing?.comment ?? '',
      reviewed: message.reviewed() ?? existing?.reviewed ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.reviews.save(review);

    // Avisar SOLO cuando hay algo nuevo que leer (sin ruido por re-guardados).
    const commentChanged =
      message.comment() !== undefined &&
      review.comment !== '' &&
      review.comment !== (existing?.comment ?? '');
    const justReviewed = message.reviewed() === true && !(existing?.reviewed ?? false);
    if (commentChanged || justReviewed) {
      await this.notifier.notifyReviewSaved({
        supervisedUserId: note.supervisedUserId,
        supervisorUserId: message.supervisorUserId(),
        patientId: note.patientId,
        sessionNoteId: note.sessionNoteId,
        noteTitle: note.noteTitle,
        change: commentChanged ? 'comentario' : 'revisada',
      });
    }

    return review;
  }
}
