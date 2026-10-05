import { DomainError } from '@/shared/domain/DomainError';

export class InvalidRecurrenceError extends DomainError {
  public constructor(detail: string) {
    super(`Recurrencia inválida: ${detail}.`);
  }
}
