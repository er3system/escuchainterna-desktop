import { DomainError } from '@/shared/domain/DomainError';

export class InvalidWeeklyAvailabilityError extends DomainError {
  public constructor(detail: string) {
    super(`Disponibilidad semanal inválida: ${detail}.`);
  }
}
