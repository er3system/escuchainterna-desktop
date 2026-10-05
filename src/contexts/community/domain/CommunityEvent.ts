import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface CommunityEventPrimitives {
  id: string;
  title: string;
  description: string;
  startsAt: string; // ISO
  link: string;
  speaker: string;
}

export class CommunityEvent extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly title: string,
    private readonly description: string,
    private readonly startsAt: Date,
    private readonly link: string,
    private readonly speaker: string,
  ) {
    super();
  }

  public static fromPrimitives(primitives: CommunityEventPrimitives): CommunityEvent {
    return new CommunityEvent(
      primitives.id,
      primitives.title,
      primitives.description,
      new Date(primitives.startsAt),
      primitives.link,
      primitives.speaker,
    );
  }

  public isUpcoming(now: Date): boolean {
    return this.startsAt.getTime() >= now.getTime();
  }

  public toPrimitives(): CommunityEventPrimitives {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      startsAt: this.startsAt.toISOString(),
      link: this.link,
      speaker: this.speaker,
    };
  }
}
