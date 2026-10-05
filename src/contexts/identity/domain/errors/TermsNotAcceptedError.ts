import { DomainError } from '@/shared/domain/DomainError';

export class TermsNotAcceptedError extends DomainError {
  public constructor() {
    super('Debes aceptar los términos y condiciones y la política de privacidad.');
  }
}
