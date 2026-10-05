import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { ClinicalRecord, type ClinicalAnswers, type ClinicalRecordKind } from '../../domain/ClinicalRecord';
import { migrateRecordSections } from '../../domain/historiaBlocks';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';

interface ClinicalRecordRow {
  id: string;
  patient_id: string;
  template_id: string | null;
  title: string;
  answers_json: string;
  /** Secciones propias compuestas (historia consolidada); '' = usa la plantilla. */
  sections_json: string;
  kind: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toAggregate(row: ClinicalRecordRow): ClinicalRecord {
  // Cifrado at-rest (v3 §1.1): las respuestas clínicas se descifran al leer.
  const answers = JSON.parse(decryptField(row.answers_json)) as ClinicalAnswers;
  // Las secciones son ESTRUCTURA (no PII), se guardan en claro.
  const sections = row.sections_json ? (JSON.parse(row.sections_json) as ClinicalSection[]) : null;
  // Migración lazy de ids de bloques recurados (expediente v2 §10): los bloques
  // añadidos con ids antiguos se remapean al vocabulario curado sin perder datos.
  const migrated = migrateRecordSections(sections, answers);
  return ClinicalRecord.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    templateId: row.template_id,
    title: row.title,
    answers: migrated.answers as ClinicalAnswers,
    sections: migrated.sections,
    kind: (row.kind as ClinicalRecordKind) || 'registro',
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Historias clínicas acotadas al dueño (owner_user_id) de la sesión. */
export class SqliteClinicalRecordRepository implements ClinicalRecordRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(record: ClinicalRecord): Promise<void> {
    const primitives = record.toPrimitives();
    await this.db.execute(
      `INSERT INTO clinical_records (id, patient_id, template_id, title, answers_json, sections_json, kind, closed_at, created_at, updated_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           answers_json = excluded.answers_json,
           sections_json = excluded.sections_json,
           kind = excluded.kind,
           closed_at = excluded.closed_at,
           updated_at = excluded.updated_at
         WHERE clinical_records.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        primitives.templateId,
        primitives.title,
        encryptField(JSON.stringify(primitives.answers)),
        primitives.sections ? JSON.stringify(primitives.sections) : '',
        primitives.kind ?? 'registro',
        primitives.closedAt ?? null,
        primitives.createdAt,
        primitives.updatedAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<ClinicalRecord | null> {
    const row = await this.db.queryRow<ClinicalRecordRow>(
      'SELECT * FROM clinical_records WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<ClinicalRecord[]> {
    const rows = await this.db.query<ClinicalRecordRow>(
      'SELECT * FROM clinical_records WHERE patient_id = ? AND owner_user_id = ? ORDER BY updated_at DESC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async findPrimaryHistory(patientId: string): Promise<ClinicalRecord | null> {
    // La primaria VIGENTE (abierta): kind='historia' y sin sellar (closed_at NULL).
    // Las selladas son expedientes anteriores (solo lectura) y no cuentan como la
    // actual. Pueden coexistir varias abiertas (episodios sin sellar): la ACTIVA es
    // la más RECIENTE (el último episodio abierto); las demás siguen editables desde
    // su propia página y aparecen como "otros expedientes abiertos".
    const row = await this.db.queryRow<ClinicalRecordRow>(
      "SELECT * FROM clinical_records WHERE patient_id = ? AND owner_user_id = ? AND kind = 'historia' AND closed_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [patientId, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM clinical_records WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
