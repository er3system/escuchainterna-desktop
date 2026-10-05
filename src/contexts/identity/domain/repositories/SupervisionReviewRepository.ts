import type { SupervisionReviewPrimitives, SupervisionReviewWithAuthor } from '../SupervisionReview';

export interface SupervisionReviewRepository {
  findByNoteAndSupervisor(
    sessionNoteId: string,
    supervisorUserId: string,
  ): Promise<SupervisionReviewPrimitives | null>;
  /** Upsert por UNIQUE(session_note_id, supervisor_user_id). Cifra el comentario at-rest. */
  save(review: SupervisionReviewPrimitives): Promise<void>;
  /** Reviews del supervisor sobre un conjunto de notas (estado en listas). */
  listForNotes(sessionNoteIds: string[], supervisorUserId: string): Promise<SupervisionReviewPrimitives[]>;
  /** Reviews sobre una nota del supervisado, con autor (vista del estudiante). */
  listForSupervisedNote(sessionNoteId: string, supervisedUserId: string): Promise<SupervisionReviewWithAuthor[]>;
  /** Ids de notas del paciente marcadas como revisadas por algún supervisor. */
  listReviewedNoteIds(supervisedUserId: string, patientId: string): Promise<string[]>;
}
