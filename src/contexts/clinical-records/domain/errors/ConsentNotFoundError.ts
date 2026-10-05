import { DomainError } from '@/shared/domain/DomainError';

export class ConsentNotFoundError extends DomainError {
  public constructor() {
    super('El consentimiento no existe o no pertenece a tus pacientes.');
  }
}
