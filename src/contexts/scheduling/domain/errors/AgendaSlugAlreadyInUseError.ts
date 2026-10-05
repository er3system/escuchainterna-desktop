import { DomainError } from '@/shared/domain/DomainError';

export class AgendaSlugAlreadyInUseError extends DomainError {
  public constructor(slug: string) {
    super(`La liga pública «${slug}» ya está en uso por otra agenda.`);
  }
}
