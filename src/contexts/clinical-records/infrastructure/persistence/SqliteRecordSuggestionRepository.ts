import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { RecordSuggestionBatch, type RecordSuggestionItem } from '../../domain/RecordSuggestionBatch';
import type { RecordSuggestionRepository } from '../../domain/repositories/RecordSuggestionRepository';

interface SuggestionRow {
  id: string;
  record_id: string;
  source_note_id: string | null;
  suggestions_json: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

function toItems(json: string): RecordSuggestionItem[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecordSuggestionItem =>
        typeof item === 'object' && item !== null && typeof (item as RecordSuggestionItem).fieldId === 'string',
    );
  } catch {
    return [];
  }
}

function toAggregate(row: SuggestionRow): RecordSuggestionBatch {
  return RecordSuggestionBatch.fromPrimitives({
    id: row.id,
    recordId: row.record_id,
    sourceNoteId: row.source_note_id,
    items: toItems(row.suggestions_json),
    status: row.status === 'resuelta' ? 'resuelta' : 'pendiente',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  });
}

/** Lotes de sugerencias de IA acotados al dueño de la sesión. */
export class SqliteRecordSuggestionRepository implements RecordSuggestionRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(batch: RecordSuggestionBatch): Promise<void> {
    const primitives = batch.toPrimitives();
    await this.db.execute(
      `INSERT INTO clinical_record_suggestions
           (id, record_id, owner_user_id, source_note_id, suggestions_json, status, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           suggestions_json = excluded.suggestions_json,
           status = excluded.status,
           resolved_at = excluded.resolved_at
         WHERE clinical_record_suggestions.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.recordId,
        this.ownerUserId,
        primitives.sourceNoteId,
        JSON.stringify(primitives.items),
        primitives.status,
        primitives.createdAt,
        primitives.resolvedAt,
      ],
    );
  }

  public async findById(id: string): Promise<RecordSuggestionBatch | null> {
    const row = await this.db.queryRow<SuggestionRow>(
      'SELECT * FROM clinical_record_suggestions WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async findOpenForRecord(recordId: string): Promise<RecordSuggestionBatch | null> {
    const row = await this.db.queryRow<SuggestionRow>(
      `SELECT * FROM clinical_record_suggestions
         WHERE record_id = ? AND owner_user_id = ? AND status = 'pendiente'
         ORDER BY created_at DESC LIMIT 1`,
      [recordId, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async deleteByRecord(recordId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM clinical_record_suggestions WHERE record_id = ? AND owner_user_id = ?',
      [recordId, this.ownerUserId],
    );
  }
}
