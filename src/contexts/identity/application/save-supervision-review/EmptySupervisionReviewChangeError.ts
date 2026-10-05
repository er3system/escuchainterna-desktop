import { DomainError } from '@/shared/domain/DomainError';

export class EmptySupervisionReviewChangeError extends DomainError {
  public constructor() {
    super('La retroalimentación debe incluir un comentario o un cambio en la marca de revisión.');
  }
}
