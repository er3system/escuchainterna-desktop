import type {
  SupervisionReviewPrimitives,
  SupervisionReviewWithAuthor,
} from '../../domain/SupervisionReview';
import type { SupervisionReviewRepository } from '../../domain/repositories/SupervisionReviewRepository';

/**
 * Read model de retroalimentación de supervisión: pinta el estado
 * "revisada/sin revisar" y los comentarios tanto en la vista del supervisor
 * (sus propias reviews) como en la del estudiante (reviews sobre SUS notas).
 */
export class ListSupervisionReviews {
  public constructor(private readonly reviews: SupervisionReviewRepository) {}

  /** Reviews del supervisor indexadas por nota (para listas y vista de nota). */
  public async forNotes(
    sessionNoteIds: string[],
    supervisorUserId: string,
  ): Promise<Record<string, SupervisionReviewPrimitives>> {
    const byNote: Record<string, SupervisionReviewPrimitives> = {};
    for (const review of await this.reviews.listForNotes(sessionNoteIds, supervisorUserId)) {
      byNote[review.sessionNoteId] = review;
    }
    return byNote;
  }

  /** Reviews sobre una nota del supervisado, con autor (vista del estudiante). */
  public async forSupervisedNote(
    sessionNoteId: string,
    supervisedUserId: string,
  ): Promise<SupervisionReviewWithAuthor[]> {
    return this.reviews.listForSupervisedNote(sessionNoteId, supervisedUserId);
  }

  /** Notas del paciente marcadas como revisadas (badge en la lista del estudiante). */
  public async reviewedNoteIds(supervisedUserId: string, patientId: string): Promise<string[]> {
    return this.reviews.listReviewedNoteIds(supervisedUserId, patientId);
  }
}
