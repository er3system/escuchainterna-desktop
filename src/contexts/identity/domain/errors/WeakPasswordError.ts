import { DomainError } from '@/shared/domain/DomainError';

export class WeakPasswordError extends DomainError {
  public constructor(message = 'La contraseña no cumple la política de seguridad.') {
    super(message);
  }
}
