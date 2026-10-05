import { DomainError } from '@/shared/domain/DomainError';

export class OrganizationNotFoundError extends DomainError {
  public constructor() {
    super('No encontramos esa organización.');
  }
}
