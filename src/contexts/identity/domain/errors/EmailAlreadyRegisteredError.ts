import { DomainError } from '@/shared/domain/DomainError';

export class EmailAlreadyRegisteredError extends DomainError {
  public constructor(email: string) {
    super(`El correo ${email} ya tiene una cuenta. Inicia sesión o recupera tu contraseña.`);
  }
}
