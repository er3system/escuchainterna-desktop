import { DomainError } from '@/shared/domain/DomainError';

export class BookingOverlapError extends DomainError {
  public constructor(startAt: Date) {
    super(`Ya existe una reservación que se empalma con el horario solicitado (${startAt.toISOString()}).`);
  }
}
