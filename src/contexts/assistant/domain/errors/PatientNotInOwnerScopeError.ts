import { DomainError } from '@/shared/domain/DomainError';

/** El paciente que se intenta anclar no pertenece al dueño en sesión. */
export class PatientNotInOwnerScopeError extends DomainError {
  public constructor() {
    super('Ese paciente no existe en tu consulta.');
  }
}
