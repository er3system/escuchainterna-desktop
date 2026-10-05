import { DomainEvent } from '@/shared/domain/DomainEvent';

export class SessionCancelledEvent extends DomainEvent {
  public constructor(
    bookingId: string,
    public readonly cancelledBy: string,
  ) {
    super('scheduling.sesion_cancelada', bookingId);
  }
}
