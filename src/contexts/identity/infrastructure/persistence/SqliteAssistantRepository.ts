import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Assistant, type AssistantPermissions } from '../../domain/Assistant';
import type { AssistantRepository } from '../../domain/repositories/AssistantRepository';

interface AssistantRow {
  id: string;
  owner_user_id: string;
  assistant_user_id: string;
  permissions_json: string;
  created_at: string;
}

function parsePermissions(json: string): AssistantPermissions {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return {
      agenda: raw.agenda !== false,
      pagos: raw.pagos !== false,
      pacientesBasico: raw.pacientes_basico !== false,
    };
  } catch {
    return { agenda: true, pagos: true, pacientesBasico: true };
  }
}

function toAggregate(row: AssistantRow): Assistant {
  return Assistant.fromPrimitives({
    id: row.id,
    ownerUserId: row.owner_user_id,
    assistantUserId: row.assistant_user_id,
    permissions: parsePermissions(row.permissions_json),
    createdAt: row.created_at,
  });
}

export class SqliteAssistantRepository implements AssistantRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(assistant: Assistant): Promise<void> {
    const primitives = assistant.toPrimitives();
    await this.db.execute(
      `INSERT INTO assistants (id, owner_user_id, assistant_user_id, permissions_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(assistant_user_id) DO UPDATE SET
           owner_user_id = excluded.owner_user_id,
           permissions_json = excluded.permissions_json`,
      [
        primitives.id,
        primitives.ownerUserId,
        primitives.assistantUserId,
        JSON.stringify({
          agenda: primitives.permissions.agenda,
          pagos: primitives.permissions.pagos,
          pacientes_basico: primitives.permissions.pacientesBasico,
        }),
        primitives.createdAt,
      ],
    );
  }

  public async findByAssistantUserId(assistantUserId: string): Promise<Assistant | null> {
    const row = await this.db.queryRow<AssistantRow>(
      'SELECT * FROM assistants WHERE assistant_user_id = ?',
      [assistantUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByOwner(ownerUserId: string): Promise<Assistant[]> {
    const rows = await this.db.query<AssistantRow>(
      'SELECT * FROM assistants WHERE owner_user_id = ? ORDER BY created_at ASC',
      [ownerUserId],
    );
    return rows.map(toAggregate);
  }
}
