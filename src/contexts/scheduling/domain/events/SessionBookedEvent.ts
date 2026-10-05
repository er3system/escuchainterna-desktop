import { DomainEvent } from '@/shared/domain/DomainEvent';

export class SessionBookedEvent extends DomainEvent {
  public constructor(
    bookingId: string,
    public readonly patientId: string,
    public readonly startAt: Date,
  ) {
    super('scheduling.sesion_agendada', bookingId);
  }
}
