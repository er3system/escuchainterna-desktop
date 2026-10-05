import { DomainError } from '@/shared/domain/DomainError';

export class IncorrectPasswordError extends DomainError {
  public constructor() {
    super('La contraseña actual no es correcta.');
  }
}
