import { PublicationPrimitives } from '../../domain/Publication';
import { PublicationContent } from '../../domain/PublicationContent';
import { PublicationNotFoundError } from '../../domain/errors/PublicationNotFoundError';
import { PublicationContentReader } from '../../domain/repositories/PublicationContentReader';
import { PublicationRepository } from '../../domain/repositories/PublicationRepository';
import { ReadPublicationMessage } from './ReadPublicationMessage';

export interface ReadPublicationResult {
  publication: PublicationPrimitives;
  /** null si el archivo del contenido aún no está disponible en disco. */
  content: PublicationContent | null;
}

/**
 * Caso de uso del lector web: devuelve los metadatos de la publicación
 * (título, categoría, fuentes…) junto con su cuerpo legible ya extraído
 * del HTML de imprenta (sin portada ni pie de PDF) y el índice de contenidos.
 */
export class ReadPublication {
  public constructor(
    private readonly repository: PublicationRepository,
    private readonly contentReader: PublicationContentReader,
  ) {}

  public async read(message: ReadPublicationMessage): Promise<ReadPublicationResult> {
    const publication = await this.repository.findById(message.publicationIdValue());
    if (!publication) throw new PublicationNotFoundError(message.publicationIdValue());

    const primitives = publication.toPrimitives();
    return {
      publication: primitives,
      content: await this.contentReader.read(primitives.htmlPath),
    };
  }
}
