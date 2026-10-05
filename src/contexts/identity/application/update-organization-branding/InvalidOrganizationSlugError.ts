import { DomainError } from '@/shared/domain/DomainError';

/** El slug será el subdominio <slug>.escuchainterna.com: minúsculas, números y guiones. */
export class InvalidOrganizationSlugError extends DomainError {
  public constructor(received: string) {
    super(
      `El slug "${received}" no es válido: usa de 3 a 40 caracteres con minúsculas, números y guiones (sin empezar ni terminar con guion).`,
    );
  }
}
