import { DomainError } from '@/shared/domain/DomainError';

export class SignatureRequestNotFoundError extends DomainError {
  public constructor() {
    super('No se encontró la solicitud de firma, o ya no está disponible.');
  }
}
