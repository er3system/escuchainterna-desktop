import { DomainError } from '@/shared/domain/DomainError';

export class PublicationNotFoundError extends DomainError {
  public constructor(publicationId: string) {
    super(`No existe la publicación con id ${publicationId}.`);
  }
}
