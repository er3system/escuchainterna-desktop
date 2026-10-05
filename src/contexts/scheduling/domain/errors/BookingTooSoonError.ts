import { DomainError } from '@/shared/domain/DomainError';

export class BookingTooSoonError extends DomainError {
  public constructor(minBookingHours: number) {
    super(`Las reservaciones requieren al menos ${minBookingHours} horas de anticipación.`);
  }
}
