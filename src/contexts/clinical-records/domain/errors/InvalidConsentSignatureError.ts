import { DomainError } from '@/shared/domain/DomainError';

export class InvalidConsentSignatureError extends DomainError {
  public constructor(message = 'Para firmar escribe tu nombre completo y acepta el documento.') {
    super(message);
  }
}
