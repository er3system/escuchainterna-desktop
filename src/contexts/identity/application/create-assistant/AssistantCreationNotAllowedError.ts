import { DomainError } from '@/shared/domain/DomainError';

/** Solo un profesional titular (no otro asistente) puede crear cuentas de asistente. */
export class AssistantCreationNotAllowedError extends DomainError {
  public constructor() {
    super('Solo el profesional titular puede crear cuentas de asistente.');
  }
}
