import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  MessageTemplateOverride,
  MessageTemplateOverrideRepository,
} from '../../domain/repositories/MessageTemplateOverrideRepository';

interface OverrideRow {
  template_key: string;
  subject: string;
  body: string;
  updated_at: string;
}

/**
 * Personalizaciones del profesional en message_templates (owner_user_id).
 * Las plantillas integradas viven en el catálogo en código; aquí solo se
 * guardan las filas personalizadas del owner.
 */
export class SqliteMessageTemplateOverrideRepository implements MessageTemplateOverrideRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findByKey(templateKey: string): Promise<MessageTemplateOverride | null> {
    const row = await this.db.queryRow<OverrideRow>(
      `SELECT template_key, subject, body, updated_at FROM message_templates
          WHERE owner_user_id = ? AND template_key = ? LIMIT 1`,
      [this.ownerUserId, templateKey],
    );
    return row ? this.hydrate(row) : null;
  }

  public async listAll(): Promise<MessageTemplateOverride[]> {
    const rows = await this.db.query<OverrideRow>(
      `SELECT template_key, subject, body, updated_at FROM message_templates
          WHERE owner_user_id = ? ORDER BY template_key`,
      [this.ownerUserId],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async save(input: {
    templateKey: string;
    name: string;
    channel: string;
    subject: string;
    body: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.queryRow<{ id: string }>(
      `SELECT id FROM message_templates WHERE owner_user_id = ? AND template_key = ? LIMIT 1`,
      [this.ownerUserId, input.templateKey],
    );

    if (existing) {
      // La clave y el nombre son fijos: solo cambian asunto y contenido.
      await this.db.execute(`UPDATE message_templates SET subject = ?, body = ?, updated_at = ? WHERE id = ?`, [
        input.subject,
        input.body,
        now,
        existing.id,
      ]);
      return;
    }

    await this.db.execute(
      `INSERT INTO message_templates (id, owner_user_id, template_key, name, channel, subject, body, is_builtin, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [randomUUID(), this.ownerUserId, input.templateKey, input.name, input.channel, input.subject, input.body, now],
    );
  }

  public async deleteByKey(templateKey: string): Promise<void> {
    await this.db.execute(`DELETE FROM message_templates WHERE owner_user_id = ? AND template_key = ?`, [
      this.ownerUserId,
      templateKey,
    ]);
  }

  private hydrate(row: OverrideRow): MessageTemplateOverride {
    return {
      templateKey: row.template_key,
      subject: row.subject,
      body: row.body,
      updatedAt: row.updated_at,
    };
  }
}
