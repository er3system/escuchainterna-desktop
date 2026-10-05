import { DomainError } from '@/shared/domain/DomainError';

export class ConsentAlreadySignedError extends DomainError {
  public constructor() {
    super('El paciente ya cuenta con un consentimiento firmado.');
  }
}
