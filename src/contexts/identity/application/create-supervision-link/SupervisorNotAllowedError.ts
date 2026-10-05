import { DomainError } from '@/shared/domain/DomainError';

/** Solo profesores o miembros con can_supervise_patients pueden supervisar. */
export class SupervisorNotAllowedError extends DomainError {
  public constructor() {
    super(
      'Ese miembro no puede supervisar: necesita rol de supervisión académica o el permiso "puede supervisar pacientes".',
    );
  }
}
