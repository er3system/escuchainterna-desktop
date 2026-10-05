import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

/**
 * Reordena las sesiones de la Evolución (P8). `orderedIds` es el orden visual de
 * ARRIBA a ABAJO (= position ASC, de la más antigua a la más reciente). Asigna
 * position = índice y valida que cada nota pertenezca al paciente. Las sesiones
 * no incluidas (p. ej. archivadas) conservan su position.
 */
export class ReorderSessions {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(patientId: string, orderedIds: string[]): Promise<void> {
    for (const [index, id] of orderedIds.entries()) {
      const note = await this.notes.findById(id);
      if (!note || !note.belongsTo(patientId)) throw new SessionNoteNotFoundError(id);
      note.placeAt(index);
      await this.notes.save(note);
    }
  }
}
