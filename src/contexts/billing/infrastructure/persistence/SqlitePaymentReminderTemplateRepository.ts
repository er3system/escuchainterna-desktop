import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  PaymentReminderTemplateContent,
  PaymentReminderTemplateRepository,
} from '../../domain/repositories/PaymentReminderTemplateRepository';
import {
  PAYMENT_REMINDER_TEMPLATE_KEY,
  PAYMENT_REMINDER_TEMPLATE_NAME,
} from '../../domain/value-objects/paymentReminderTemplate';

interface TemplateRow {
  name: string;
  body: string;
}

/**
 * Plantilla `recordatorio_pago` en message_templates: la fila del profesional
 * (owner_user_id) o la base de la plataforma (owner NULL, is_builtin=1).
 */
export class SqlitePaymentReminderTemplateRepository implements PaymentReminderTemplateRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findOwn(): Promise<PaymentReminderTemplateContent | null> {
    const row = await this.db.queryRow<TemplateRow>(
      `SELECT name, body FROM message_templates
         WHERE owner_user_id = ? AND template_key = ? LIMIT 1`,
      [this.ownerUserId, PAYMENT_REMINDER_TEMPLATE_KEY],
    );
    return row ? { name: row.name, body: row.body } : null;
  }

  public async findBuiltin(): Promise<PaymentReminderTemplateContent | null> {
    const row = await this.db.queryRow<TemplateRow>(
      `SELECT name, body FROM message_templates
         WHERE owner_user_id IS NULL AND template_key = ? LIMIT 1`,
      [PAYMENT_REMINDER_TEMPLATE_KEY],
    );
    return row ? { name: row.name, body: row.body } : null;
  }

  public async saveOwn(body: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.queryRow<{ id: string }>(
      `SELECT id FROM message_templates WHERE owner_user_id = ? AND template_key = ? LIMIT 1`,
      [this.ownerUserId, PAYMENT_REMINDER_TEMPLATE_KEY],
    );

    if (existing) {
      // El nombre es fijo: solo cambia el contenido.
      await this.db.execute(`UPDATE message_templates SET body = ?, updated_at = ? WHERE id = ?`, [
        body,
        now,
        existing.id,
      ]);
      return;
    }

    const builtin = await this.findBuiltin();
    await this.db.execute(
      `INSERT INTO message_templates (id, owner_user_id, template_key, name, channel, subject, body, is_builtin, updated_at)
       VALUES (?, ?, ?, ?, 'whatsapp', '', ?, 0, ?)`,
      [
        randomUUID(),
        this.ownerUserId,
        PAYMENT_REMINDER_TEMPLATE_KEY,
        builtin?.name ?? PAYMENT_REMINDER_TEMPLATE_NAME,
        body,
        now,
      ],
    );
  }
}
