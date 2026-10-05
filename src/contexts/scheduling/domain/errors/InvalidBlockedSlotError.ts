import { DomainError } from '@/shared/domain/DomainError';

export class InvalidBlockedSlotError extends DomainError {
  public constructor(detail: string) {
    super(`Bloqueo de agenda inválido: ${detail}.`);
  }
}
