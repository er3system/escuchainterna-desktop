import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

/**
 * Archiva o restaura una nota de sesión: la quita/devuelve de la Evolución sin
 * borrarla (recuperable). Acotada por dueño vía el repositorio.
 */
export class SetSessionArchived {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(noteId: string, patientId: string, archived: boolean): Promise<void> {
    const note = await this.notes.findById(noteId);
    if (!note || !note.belongsTo(patientId)) throw new Error('Sesión no encontrada.');
    if (archived) note.archive();
    else note.restore();
    await this.notes.save(note);
  }
}
