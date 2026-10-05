import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  AdminAuditEntry,
  AdminAuditLogRepository,
  AdminAuditRecordInput,
  AdminAuditSearchFilters,
} from '../../domain/repositories/AdminAuditLogRepository';

const DEFAULT_LIMIT = 200;

interface AuditRow {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target: string;
  details_json: string;
  created_at: string;
}

function toEntry(row: AuditRow): AdminAuditEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email ?? '',
    action: row.action,
    target: row.target,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  };
}

/** Bitácora del hub de administración (tabla admin_audit_log). */
export class SqliteAdminAuditLogRepository implements AdminAuditLogRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async record(input: AdminAuditRecordInput): Promise<void> {
    await this.db.execute(
      `INSERT INTO admin_audit_log (id, actor_user_id, action, target, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.actorUserId,
        input.action,
        input.target ?? '',
        JSON.stringify(input.details ?? {}),
        new Date().toISOString(),
      ],
    );
  }

  public async search(filters: AdminAuditSearchFilters): Promise<AdminAuditEntry[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.action?.trim()) {
      conditions.push('l.action = ?');
      params.push(filters.action.trim());
    }
    if (filters.actorEmail?.trim()) {
      conditions.push('u.email LIKE ?');
      params.push(`%${filters.actorEmail.trim().toLowerCase()}%`);
    }
    if (filters.from?.trim()) {
      conditions.push('substr(l.created_at, 1, 10) >= ?');
      params.push(filters.from.trim());
    }
    if (filters.to?.trim()) {
      conditions.push('substr(l.created_at, 1, 10) <= ?');
      params.push(filters.to.trim());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 1000) : DEFAULT_LIMIT;
    const rows = await this.db.query<AuditRow>(
      `SELECT l.id, l.actor_user_id, u.email AS actor_email, l.action, l.target, l.details_json, l.created_at
           FROM admin_audit_log l
           LEFT JOIN users u ON u.id = l.actor_user_id
          ${where}
          ORDER BY l.created_at DESC
          LIMIT ?`,
      [...params, limit],
    );
    return rows.map(toEntry);
  }

  public async distinctActions(): Promise<string[]> {
    const rows = await this.db.query<{ action: string }>(
      'SELECT DISTINCT action FROM admin_audit_log ORDER BY action ASC',
    );
    return rows.map((row) => row.action);
  }
}
