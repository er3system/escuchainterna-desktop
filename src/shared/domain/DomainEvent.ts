export abstract class DomainEvent {
  public readonly occurredOn: Date;

  protected constructor(
    public readonly eventName: string,
    public readonly aggregateId: string,
  ) {
    this.occurredOn = new Date();
  }
}
