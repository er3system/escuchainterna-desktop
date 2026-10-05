import type { SessionNotePrimitives } from '../../domain/SessionNote';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

export class ListSessionNotes {
  public constructor(private readonly notes: SessionNoteRepository) {}

  /** Notas ACTIVAS del paciente (sin archivar), más recientes primero. */
  public async execute(patientId: string): Promise<SessionNotePrimitives[]> {
    const notes = await this.notes.listByPatient(patientId);
    return notes
      .map((note) => note.toPrimitives())
      .filter((note) => !note.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Notas ARCHIVADAS del paciente (recuperables), más recientes primero. */
  public async executeArchived(patientId: string): Promise<SessionNotePrimitives[]> {
    const notes = await this.notes.listByPatient(patientId);
    return notes
      .map((note) => note.toPrimitives())
      .filter((note) => note.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
