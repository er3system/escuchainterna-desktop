import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { CommunityEvent } from '../../domain/CommunityEvent';
import { CommunityEventRepository } from '../../domain/repositories/CommunityEventRepository';

interface EventRow {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  link: string;
  speaker: string;
}

export class SqliteCommunityEventRepository implements CommunityEventRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async listUpcoming(now: Date): Promise<CommunityEvent[]> {
    const rows = await this.db.query<EventRow>(
      'SELECT * FROM community_events WHERE starts_at >= ? ORDER BY starts_at ASC',
      [now.toISOString()],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async findById(id: string): Promise<CommunityEvent | null> {
    const row = await this.db.queryRow<EventRow>('SELECT * FROM community_events WHERE id = ?', [id]);
    return row ? this.hydrate(row) : null;
  }

  private hydrate(row: EventRow): CommunityEvent {
    return CommunityEvent.fromPrimitives({
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      link: row.link,
      speaker: row.speaker,
    });
  }
}
