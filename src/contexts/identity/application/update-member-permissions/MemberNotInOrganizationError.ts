import { DomainError } from '@/shared/domain/DomainError';

/** El usuario indicado no pertenece a la organización del maestro en sesión. */
export class MemberNotInOrganizationError extends DomainError {
  public constructor() {
    super('Ese usuario no es miembro de tu organización.');
  }
}
