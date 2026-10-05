import { DomainError } from '@/shared/domain/DomainError';

export class BookingOutsideAvailabilityError extends DomainError {
  public constructor(startAt: Date) {
    super(`El horario solicitado (${startAt.toISOString()}) está fuera de la disponibilidad configurada.`);
  }
}
