import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';
import type { SaveSessionAnswersMessage } from './SaveSessionAnswersMessage';

/** Persiste las respuestas del formulario estructurado de una nota de sesión. */
export class SaveSessionAnswers {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(message: SaveSessionAnswersMessage): Promise<void> {
    const note = await this.notes.findById(message.noteId());
    if (!note || !note.belongsTo(message.patientId())) {
      throw new SessionNoteNotFoundError(message.noteId());
    }
    // Funde (no reemplaza): una sesión puede tener respuestas de varias fuentes
    // independientes (formulario base + bloques); guardar una no debe pisar otra.
    note.mergeAnswers(message.answers());
    await this.notes.save(note);
  }
}
