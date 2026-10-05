import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  OutboxLogCriteria,
  OutboxLogEntry,
  OutboxMessageLog,
} from '../../domain/repositories/OutboxMessageLog';

interface OutboxRow {
  id: string;
  channel: OutboxLogEntry['channel'];
  recipient: string;
  recipient_name: string;
  template: string;
  subject: string;
  body: string;
  status: OutboxLogEntry['status'];
  created_at: string;
  sent_at: string | null;
}

/** Registro de mensajes del outbox acotado al dueño (owner_user_id) de la sesión. */
export class SqliteOutboxMessageLog implements OutboxMessageLog {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async search(criteria: OutboxLogCriteria): Promise<OutboxLogEntry[]> {
    const { where, params } = this.buildWhere(criteria);
    const rows = await this.db.query<OutboxRow>(
      `SELECT id, channel, recipient, recipient_name, template, subject, body, status, created_at, sent_at
           FROM outbox_messages ${where}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
      [...params, criteria.limit ?? 50, criteria.offset ?? 0],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async countMatching(criteria: OutboxLogCriteria): Promise<number> {
    const { where, params } = this.buildWhere(criteria);
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox_messages ${where}`,
      params,
    );
    return row?.n ?? 0;
  }

  public async listTemplates(): Promise<string[]> {
    const rows = await this.db.query<{ template: string }>(
      'SELECT DISTINCT template FROM outbox_messages WHERE owner_user_id = ? ORDER BY template',
      [this.ownerUserId],
    );
    return rows.map((row) => row.template);
  }

  private buildWhere(criteria: OutboxLogCriteria): { where: string; params: Array<string> } {
    const conditions: string[] = ['owner_user_id = ?'];
    const params: string[] = [this.ownerUserId];
    if (criteria.channel) {
      conditions.push('channel = ?');
      params.push(criteria.channel);
    }
    if (criteria.template) {
      conditions.push('template = ?');
      params.push(criteria.template);
    }
    if (criteria.search) {
      conditions.push('(recipient_name LIKE ? OR recipient LIKE ?)');
      const like = `%${criteria.search}%`;
      params.push(like, like);
    }
    if (criteria.recipient) {
      conditions.push('recipient = ?');
      params.push(criteria.recipient);
    }
    if (criteria.excludeTemplate) {
      conditions.push('template != ?');
      params.push(criteria.excludeTemplate);
    }
    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private hydrate(row: OutboxRow): OutboxLogEntry {
    return {
      id: row.id,
      channel: row.channel,
      recipient: row.recipient,
      recipientName: row.recipient_name,
      template: row.template,
      subject: row.subject,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    };
  }
}
