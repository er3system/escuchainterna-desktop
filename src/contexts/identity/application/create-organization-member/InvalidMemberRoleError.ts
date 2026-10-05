import { DomainError } from '@/shared/domain/DomainError';

/** Desde el hub de organización solo se crean miembros psicólogos o profesores. */
export class InvalidMemberRoleError extends DomainError {
  public constructor(received: string) {
    super(`Rol de miembro inválido: "${received}". Solo se permiten "psychologist" o "professor".`);
  }
}
