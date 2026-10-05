import { DomainEvent } from '@/shared/domain/DomainEvent';

export class SessionRescheduledEvent extends DomainEvent {
  public constructor(
    bookingId: string,
    public readonly previousStartAt: Date,
    public readonly newStartAt: Date,
  ) {
    super('scheduling.sesion_reagendada', bookingId);
  }
}
