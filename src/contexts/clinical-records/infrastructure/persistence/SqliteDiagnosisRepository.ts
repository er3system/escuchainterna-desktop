import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Diagnosis, type DiagnosisStatus } from '../../domain/Diagnosis';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';

interface DiagnosisRow {
  id: string;
  patient_id: string;
  cie11_code: string;
  cie11_title: string;
  notes: string;
  status: string;
  kind: string | null;
  diagnosed_by_user_id: string | null;
  diagnosed_at: string;
}

function toAggregate(row: DiagnosisRow): Diagnosis {
  return Diagnosis.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    cie11Code: row.cie11_code,
    cie11Title: row.cie11_title,
    notes: row.notes,
    status: row.status as DiagnosisStatus,
    kind: row.kind === 'formal' ? 'formal' : 'hipotesis',
    diagnosedByUserId: row.diagnosed_by_user_id ?? '',
    diagnosedAt: row.diagnosed_at,
  });
}

/** Diagnósticos acotados al dueño (owner_user_id) de la sesión. */
export class SqliteDiagnosisRepository implements DiagnosisRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(diagnosis: Diagnosis): Promise<void> {
    const primitives = diagnosis.toPrimitives();
    await this.db.execute(
      `INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, notes, status, kind, diagnosed_by_user_id, diagnosed_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           notes = excluded.notes,
           status = excluded.status,
           kind = excluded.kind,
           diagnosed_by_user_id = excluded.diagnosed_by_user_id
         WHERE diagnoses.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        primitives.cie11Code,
        primitives.cie11Title,
        primitives.notes,
        primitives.status,
        primitives.kind,
        primitives.diagnosedByUserId === '' ? null : primitives.diagnosedByUserId,
        primitives.diagnosedAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<Diagnosis | null> {
    const row = await this.db.queryRow<DiagnosisRow>(
      'SELECT * FROM diagnoses WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<Diagnosis[]> {
    const rows = await this.db.query<DiagnosisRow>(
      'SELECT * FROM diagnoses WHERE patient_id = ? AND owner_user_id = ? ORDER BY diagnosed_at DESC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM diagnoses WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
