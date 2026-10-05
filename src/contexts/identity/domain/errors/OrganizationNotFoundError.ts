import { DomainError } from '@/shared/domain/DomainError';

export class OrganizationNotFoundError extends DomainError {
  public constructor(organizationId: string) {
    super(`No existe la organización "${organizationId}".`);
  }
}
