import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  AiInteraction,
  AiInteractionKind,
  AiInteractionLog,
  AiProvider,
} from '../../domain/repositories/AiInteractionLog';

interface AiInteractionRow {
  id: string;
  session_note_id: string;
  kind: string;
  prompt: string;
  response: string;
  provider: string;
  created_at: string;
}

function toInteraction(row: AiInteractionRow): AiInteraction {
  return {
    id: row.id,
    sessionNoteId: row.session_note_id,
    kind: row.kind as AiInteractionKind,
    prompt: row.prompt,
    response: row.response,
    provider: row.provider as AiProvider,
    createdAt: row.created_at,
  };
}

/** Registro de interacciones de IA acotado al dueño (owner_user_id) de la sesión. */
export class SqliteAiInteractionLog implements AiInteractionLog {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async append(interaction: AiInteraction): Promise<void> {
    await this.db.execute(
      `INSERT INTO ai_interactions (id, session_note_id, kind, prompt, response, provider, created_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        interaction.id,
        interaction.sessionNoteId,
        interaction.kind,
        interaction.prompt,
        interaction.response,
        interaction.provider,
        interaction.createdAt,
        this.ownerUserId,
      ],
    );
  }

  public async listForNote(sessionNoteId: string, kind?: AiInteractionKind): Promise<AiInteraction[]> {
    const rows = kind
      ? await this.db.query<AiInteractionRow>(
          'SELECT * FROM ai_interactions WHERE session_note_id = ? AND kind = ? AND owner_user_id = ? ORDER BY created_at',
          [sessionNoteId, kind, this.ownerUserId],
        )
      : await this.db.query<AiInteractionRow>(
          'SELECT * FROM ai_interactions WHERE session_note_id = ? AND owner_user_id = ? ORDER BY created_at',
          [sessionNoteId, this.ownerUserId],
        );
    return rows.map(toInteraction);
  }

  public async latestForNote(
    sessionNoteId: string,
    kind: AiInteractionKind,
  ): Promise<AiInteraction | null> {
    const row = await this.db.queryRow<AiInteractionRow>(
      'SELECT * FROM ai_interactions WHERE session_note_id = ? AND kind = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionNoteId, kind, this.ownerUserId],
    );
    return row ? toInteraction(row) : null;
  }
}
