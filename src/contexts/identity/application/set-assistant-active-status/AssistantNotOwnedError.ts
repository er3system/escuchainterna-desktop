import { DomainError } from '@/shared/domain/DomainError';

/** Solo el titular que creó al asistente puede activarlo o desactivarlo. */
export class AssistantNotOwnedError extends DomainError {
  public constructor() {
    super('Ese asistente no pertenece a tu consulta.');
  }
}
