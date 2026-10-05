import { DomainEvent } from './DomainEvent';

export abstract class AggregateRoot {
  private recordedEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.recordedEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = this.recordedEvents;
    this.recordedEvents = [];
    return events;
  }
}
