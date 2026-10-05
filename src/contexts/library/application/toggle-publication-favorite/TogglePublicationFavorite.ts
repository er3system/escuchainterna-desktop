import { PublicationRepository } from '../../domain/repositories/PublicationRepository';
import { PublicationNotFoundError } from '../../domain/errors/PublicationNotFoundError';
import { TogglePublicationFavoriteMessage } from './TogglePublicationFavoriteMessage';

export interface TogglePublicationFavoriteResult {
  favorite: boolean;
}

export class TogglePublicationFavorite {
  public constructor(private readonly repository: PublicationRepository) {}

  public async toggle(message: TogglePublicationFavoriteMessage): Promise<TogglePublicationFavoriteResult> {
    const publication = await this.repository.findById(message.publicationIdValue());
    if (!publication) throw new PublicationNotFoundError(message.publicationIdValue());

    if (publication.isFavorite()) {
      publication.unmarkAsFavorite();
      await this.repository.removeFromFavorites(publication);
    } else {
      publication.markAsFavorite();
      await this.repository.addToFavorites(publication);
    }

    return { favorite: publication.isFavorite() };
  }
}
