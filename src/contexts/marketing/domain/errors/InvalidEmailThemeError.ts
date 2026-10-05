import { DomainError } from '@/shared/domain/DomainError';

export class InvalidEmailThemeError extends DomainError {
  public constructor(theme: string) {
    super(`"${theme}" no es un tema de correo válido.`);
  }
}
