import { DomainError } from '@/shared/domain/DomainError';

export class InvalidCredentialsError extends DomainError {
  public constructor() {
    super('Correo o contraseña incorrectos.');
  }
}
