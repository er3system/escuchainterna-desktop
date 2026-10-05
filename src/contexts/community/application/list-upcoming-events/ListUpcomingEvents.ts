import { CommunityEventPrimitives } from '../../domain/CommunityEvent';
import { CommunityEventRepository } from '../../domain/repositories/CommunityEventRepository';

export class ListUpcomingEvents {
  public constructor(private readonly events: CommunityEventRepository) {}

  public async list(now: Date = new Date()): Promise<CommunityEventPrimitives[]> {
    const events = await this.events.listUpcoming(now);
    return events.map((event) => event.toPrimitives());
  }
}
