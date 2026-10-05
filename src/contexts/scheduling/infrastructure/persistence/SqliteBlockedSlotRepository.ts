import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { BlockedSlot } from '../../domain/BlockedSlot';
import type { BlockedSlotPrimitives } from '../../domain/BlockedSlot';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';

interface BlockedSlotRow {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  created_at: string;
}

/** Repositorio de bloqueos de agenda acotado al dueño (owner_user_id). */
export class SqliteBlockedSlotRepository implements BlockedSlotRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(slot: BlockedSlot): Promise<void> {
    const primitives = slot.toPrimitives();
    await this.db.execute(
      `INSERT INTO blocked_slots
           (id, owner_user_id, start_at, end_at, title, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           owner_user_id = excluded.owner_user_id,
           start_at = excluded.start_at,
           end_at = excluded.end_at,
           title = excluded.title,
           created_at = excluded.created_at`,
      [
        primitives.id,
        this.ownerUserId,
        primitives.startAt,
        primitives.endAt,
        primitives.title,
        primitives.createdAt,
      ],
    );
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM blocked_slots WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }

  public async findById(id: string): Promise<BlockedSlot | null> {
    const row = await this.db.queryRow<BlockedSlotRow>(
      'SELECT * FROM blocked_slots WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? BlockedSlot.fromPrimitives(this.hydrate(row)) : null;
  }

  public async findBetween(from: Date, to: Date): Promise<BlockedSlot[]> {
    const rows = await this.db.query<BlockedSlotRow>(
      `SELECT * FROM blocked_slots
         WHERE owner_user_id = ? AND start_at < ? AND end_at > ?
         ORDER BY start_at ASC`,
      [this.ownerUserId, to.toISOString(), from.toISOString()],
    );
    return rows.map((row) => BlockedSlot.fromPrimitives(this.hydrate(row)));
  }

  public async listUpcoming(now: Date, limit: number): Promise<BlockedSlot[]> {
    const rows = await this.db.query<BlockedSlotRow>(
      `SELECT * FROM blocked_slots
         WHERE owner_user_id = ? AND end_at > ?
         ORDER BY start_at ASC
         LIMIT ?`,
      [this.ownerUserId, now.toISOString(), Math.max(1, Math.trunc(limit))],
    );
    return rows.map((row) => BlockedSlot.fromPrimitives(this.hydrate(row)));
  }

  private hydrate(row: BlockedSlotRow): BlockedSlotPrimitives {
    return {
      id: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
      title: row.title ?? '',
      createdAt: row.created_at,
    };
  }
}
