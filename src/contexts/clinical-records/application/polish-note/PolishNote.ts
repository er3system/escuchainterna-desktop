import type { SessionInsights } from '../../domain/SessionInsights';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';

/**
 * Genera un borrador pulido del texto de una nota de sesión. NO lo guarda ni
 * reemplaza nada: devuelve el borrador para que el profesional lo revise y
 * decida en la UI (IA sugiere, humano aprueba).
 */
export class PolishNote {
  public constructor(
    private readonly notes: SessionNoteRepository,
    private readonly insights: SessionInsights,
  ) {}

  public async execute(noteId: string, patientId: string): Promise<string> {
    const note = await this.notes.findById(noteId);
    if (!note || !note.belongsTo(patientId)) throw new SessionNoteNotFoundError(noteId);
    return this.insights.polishNote(note.currentContent());
  }
}
