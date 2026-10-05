import { PublicationRepository } from '../../domain/repositories/PublicationRepository';
import { PublicationNotFoundError } from '../../domain/errors/PublicationNotFoundError';
import { MarkPublicationReviewedMessage } from './MarkPublicationReviewedMessage';

export interface MarkPublicationReviewedResult {
  reviewed: boolean;
  reviewedAt: string | null;
}

/**
 * Otorga el sello "Revisada por el equipo clínico de EscuchaInterna" a una
 * publicación de la colección (v3 §8). Solo el admin de plataforma puede
 * invocarlo (la capa de routes/actions aplica el guard). Idempotente.
 */
export class MarkPublicationReviewed {
  public constructor(private readonly repository: PublicationRepository) {}

  public async mark(message: MarkPublicationReviewedMessage): Promise<MarkPublicationReviewedResult> {
    const publication = await this.repository.findById(message.publicationIdValue());
    if (!publication) throw new PublicationNotFoundError(message.publicationIdValue());

    publication.markAsReviewed();
    await this.repository.save(publication);

    const primitives = publication.toPrimitives();
    return { reviewed: primitives.reviewed, reviewedAt: primitives.reviewedAt };
  }
}
