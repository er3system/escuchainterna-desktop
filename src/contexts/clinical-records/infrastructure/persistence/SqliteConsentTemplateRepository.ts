import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { ConsentTemplate } from '../../domain/ConsentTemplate';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';

interface ConsentTemplateRow {
  id: string;
  title: string;
  body: string;
  updated_at: string;
}

/**
 * Plantilla de consentimiento (1 por owner, UNIQUE en owner_user_id).
 * El cuerpo NO se cifra: no es dato clínico de un paciente, es el texto
 * editable del profesional (los snapshots emitidos sí se cifran en
 * patient_consents.template_body).
 */
export class SqliteConsentTemplateRepository implements ConsentTemplateRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async find(): Promise<ConsentTemplate | null> {
    const row = await this.db.queryRow<ConsentTemplateRow>(
      'SELECT id, title, body, updated_at FROM consent_templates WHERE owner_user_id = ?',
      [this.ownerUserId],
    );
    if (!row) return null;
    return ConsentTemplate.fromPrimitives({
      id: row.id,
      title: row.title,
      body: row.body,
      updatedAt: row.updated_at,
    });
  }

  public async save(template: ConsentTemplate): Promise<void> {
    const primitives = template.toPrimitives();
    // Upsert keyed en la PK (id): guardar la misma plantilla editada reemplaza su fila.
    await this.db.execute(
      `INSERT INTO consent_templates (id, owner_user_id, title, body, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           owner_user_id = excluded.owner_user_id,
           title = excluded.title,
           body = excluded.body,
           updated_at = excluded.updated_at`,
      [primitives.id, this.ownerUserId, primitives.title, primitives.body, primitives.updatedAt],
    );
  }
}
