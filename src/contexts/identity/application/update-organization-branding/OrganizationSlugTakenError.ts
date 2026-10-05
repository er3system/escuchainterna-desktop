import { DomainError } from '@/shared/domain/DomainError';

/** Cada organización necesita un subdominio único. */
export class OrganizationSlugTakenError extends DomainError {
  public constructor(slug: string) {
    super(`El slug "${slug}" ya lo usa otra organización. Elige uno distinto.`);
  }
}
