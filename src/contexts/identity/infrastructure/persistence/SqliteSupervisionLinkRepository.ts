import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { SupervisionLink, type SupervisionScope } from '../../domain/SupervisionLink';
import type { SupervisionLinkRepository } from '../../domain/repositories/SupervisionLinkRepository';

interface LinkRow {
  id: string;
  organization_id: string;
  supervisor_user_id: string;
  supervised_user_id: string;
  scope_json: string;
  created_at: string;
}

function parseScope(json: string): SupervisionScope {
  try {
    const raw = JSON.parse(json || '{}') as Partial<SupervisionScope>;
    return {
      notas: raw.notas ?? true,
      historias: raw.historias ?? true,
      pagos: raw.pagos ?? false,
    };
  } catch {
    return { notas: true, historias: true, pagos: false };
  }
}

function toAggregate(row: LinkRow): SupervisionLink {
  return SupervisionLink.fromPrimitives({
    id: row.id,
    organizationId: row.organization_id,
    supervisorUserId: row.supervisor_user_id,
    supervisedUserId: row.supervised_user_id,
    scope: parseScope(row.scope_json),
    createdAt: row.created_at,
  });
}

export class SqliteSupervisionLinkRepository implements SupervisionLinkRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(link: SupervisionLink): Promise<void> {
    const primitives = link.toPrimitives();
    await this.db.execute(
      `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(organization_id, supervisor_user_id, supervised_user_id) DO UPDATE SET
           scope_json = excluded.scope_json,
           revoked_at = NULL`,
      [
        primitives.id,
        primitives.organizationId,
        primitives.supervisorUserId,
        primitives.supervisedUserId,
        JSON.stringify(primitives.scope),
        primitives.createdAt,
      ],
    );
  }

  public async listBySupervisor(supervisorUserId: string): Promise<SupervisionLink[]> {
    const rows = await this.db.query<LinkRow>(
      'SELECT * FROM supervision_links WHERE supervisor_user_id = ? AND revoked_at IS NULL ORDER BY created_at ASC',
      [supervisorUserId],
    );
    return rows.map(toAggregate);
  }

  public async supervisesAnyone(supervisorUserId: string): Promise<boolean> {
    const row = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM supervision_links WHERE supervisor_user_id = ? AND revoked_at IS NULL',
      [supervisorUserId],
    );
    return (row?.n ?? 0) > 0;
  }
}
