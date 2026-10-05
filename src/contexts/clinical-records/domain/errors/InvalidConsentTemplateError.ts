import { DomainError } from '@/shared/domain/DomainError';

export class InvalidConsentTemplateError extends DomainError {
  public constructor(message = 'La plantilla de consentimiento necesita un título y un texto.') {
    super(message);
  }
}
