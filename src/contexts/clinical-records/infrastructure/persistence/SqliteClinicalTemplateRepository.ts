import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  ensureAdditionalNotesSection,
  type ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import { ClinicalTemplate } from '../../domain/ClinicalTemplate';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';

interface TemplateRow {
  id: string;
  name: string;
  therapy_type: string;
  description: string;
  sections_json: string;
  is_builtin: number;
  created_at: string;
}

function toAggregate(row: TemplateRow): ClinicalTemplate {
  const sections = JSON.parse(row.sections_json) as ClinicalSection[];
  return ClinicalTemplate.fromPrimitives({
    id: row.id,
    name: row.name,
    therapyType: row.therapy_type,
    description: row.description,
    // Las integradas guardadas antes de la v2 ganan la sección "Notas adicionales".
    sections: row.is_builtin === 1 ? ensureAdditionalNotesSection(sections) : sections,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
  });
}

/**
 * Plantillas de historia clínica: las integradas (is_builtin=1, owner NULL)
 * son compartidas; las personalizadas pertenecen al dueño de la sesión.
 */
export class SqliteClinicalTemplateRepository implements ClinicalTemplateRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(template: ClinicalTemplate): Promise<void> {
    const primitives = template.toPrimitives();
    await this.db.execute(
      `INSERT INTO clinical_record_templates (id, name, therapy_type, description, sections_json, is_builtin, created_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           therapy_type = excluded.therapy_type,
           description = excluded.description,
           sections_json = excluded.sections_json`,
      [
        primitives.id,
        primitives.name,
        primitives.therapyType,
        primitives.description,
        JSON.stringify(primitives.sections),
        primitives.isBuiltin ? 1 : 0,
        primitives.createdAt,
        primitives.isBuiltin ? null : this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<ClinicalTemplate | null> {
    const row = await this.db.queryRow<TemplateRow>(
      'SELECT * FROM clinical_record_templates WHERE id = ? AND (is_builtin = 1 OR owner_user_id = ?)',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listAll(): Promise<ClinicalTemplate[]> {
    const rows = await this.db.query<TemplateRow>(
      'SELECT * FROM clinical_record_templates WHERE is_builtin = 1 OR owner_user_id = ? ORDER BY is_builtin DESC, name',
      [this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM clinical_record_templates WHERE id = ? AND is_builtin = 0 AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
  }
}
