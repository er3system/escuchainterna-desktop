import { DomainError } from '@/shared/domain/DomainError';

export class BookingNotFoundError extends DomainError {
  public constructor(bookingId: string) {
    super(`No existe la reservación «${bookingId}».`);
  }
}
