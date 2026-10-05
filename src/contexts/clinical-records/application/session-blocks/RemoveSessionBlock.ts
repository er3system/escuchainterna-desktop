import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

/**
 * Quita un bloque (sección) de una SESIÓN por id de sección (P6.1). Solo opera
 * sobre bloques añadidos (ids namespaced con ':'); la plantilla fija 1ª/seguimiento
 * no se toca aquí. `SessionNote.removeSection` poda además las respuestas
 * namespaced del bloque, así no quedan huérfanas ni reaparecen al re-añadirlo.
 */
export class RemoveSessionBlock {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(noteId: string, patientId: string, sectionId: string): Promise<void> {
    const note = await this.notes.findById(noteId);
    if (!note || !note.belongsTo(patientId)) {
      throw new SessionNoteNotFoundError(noteId);
    }
    // Protege la plantilla fija de sesión: solo se quitan bloques namespaced.
    if (!sectionId.includes(':')) return;
    note.removeSection(sectionId);
    await this.notes.save(note);
  }
}
