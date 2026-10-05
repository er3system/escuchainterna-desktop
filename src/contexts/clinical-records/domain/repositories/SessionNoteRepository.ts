import type { SessionNote } from '../SessionNote';

export interface SessionNoteRepository {
  save(note: SessionNote): Promise<void>;
  findById(id: string): Promise<SessionNote | null>;
  listByPatient(patientId: string): Promise<SessionNote[]>;
  delete(id: string): Promise<void>;
}
