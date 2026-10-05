import { DomainError } from '@/shared/domain/DomainError';

export class OrganizationSlugTakenError extends DomainError {
  public constructor(slug: string) {
    super(`El slug "${slug}" ya está en uso por otra organización.`);
  }
}
