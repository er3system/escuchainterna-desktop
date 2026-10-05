import { DomainError } from '@/shared/domain/DomainError';

export class InvalidAgendaConfigurationError extends DomainError {
  public constructor(detail: string) {
    super(`Configuración de agenda inválida: ${detail}.`);
  }
}
