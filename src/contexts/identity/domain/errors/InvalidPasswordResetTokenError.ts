import { DomainError } from '@/shared/domain/DomainError';

export class InvalidPasswordResetTokenError extends DomainError {
  public constructor() {
    super('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.');
  }
}
