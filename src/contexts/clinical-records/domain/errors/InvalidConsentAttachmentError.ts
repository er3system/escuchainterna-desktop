import { DomainError } from '@/shared/domain/DomainError';

export class InvalidConsentAttachmentError extends DomainError {
  public constructor(message = 'El consentimiento firmado debe adjuntarse como imagen (foto/escaneo) o PDF.') {
    super(message);
  }
}
