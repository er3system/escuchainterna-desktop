import { DomainError } from '@/shared/domain/DomainError';

export class InvalidTemplateSectionsError extends DomainError {
  public constructor(reason: string) {
    super(reason);
  }
}
