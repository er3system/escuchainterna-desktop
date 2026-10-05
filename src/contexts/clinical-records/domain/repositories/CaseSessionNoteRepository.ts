import type { CaseSessionNote } from '../CaseSessionNote';

export interface CaseSessionNoteRepository {
  save(note: CaseSessionNote): Promise<void>;
  findById(id: string): Promise<CaseSessionNote | null>;
  /** Sesiones del caso (más recientes primero). */
  listByCase(caseId: string): Promise<CaseSessionNote[]>;
  delete(id: string): Promise<void>;
}
