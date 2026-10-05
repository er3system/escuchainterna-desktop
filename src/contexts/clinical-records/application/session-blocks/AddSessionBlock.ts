import { historiaBlockCatalog, namespaceBlockSection } from '../../domain/historiaBlocks';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

/**
 * Añade un bloque del catálogo curado a una SESIÓN (P6.1). Solo se permiten los
 * bloques cuyo `addableIn` incluye 'sesion' (p. ej. una técnica con seguimiento);
 * un genograma u objetivos SMART pertenecen al núcleo, no a una sesión suelta.
 * Los ids de la sección y de sus campos se reescriben con el id del bloque
 * (namespacing compartido con la historia) para no colisionar en las respuestas.
 * Bloque desconocido o no añadible en sesión = no-op; ya presente = no duplica.
 */
export class AddSessionBlock {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(noteId: string, patientId: string, blockId: string): Promise<void> {
    const note = await this.notes.findById(noteId);
    if (!note || !note.belongsTo(patientId)) {
      throw new SessionNoteNotFoundError(noteId);
    }
    const block = historiaBlockCatalog().find((candidate) => candidate.id === blockId);
    if (!block || !block.addableIn.includes('sesion')) return;
    note.addSection(namespaceBlockSection(block.id, block.section));
    await this.notes.save(note);
  }
}
