import { DomainError } from '@/shared/domain/DomainError';

export class InvalidBookingDataError extends DomainError {
  public constructor(detail: string) {
    super(`Datos de reservación inválidos: ${detail}.`);
  }
}
