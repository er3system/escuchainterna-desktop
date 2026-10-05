import { CommunityEvent } from '../CommunityEvent';

export interface CommunityEventRepository {
  listUpcoming(now: Date): Promise<CommunityEvent[]>;
  findById(id: string): Promise<CommunityEvent | null>;
}
