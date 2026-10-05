import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { PatientFile } from '../../domain/PatientFile';
import type { PatientFileRepository } from '../../domain/repositories/PatientFileRepository';

interface PatientFileRow {
  id: string;
  patient_id: string;
  filename: string;
  stored_path: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

function toAggregate(row: PatientFileRow): PatientFile {
  return PatientFile.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    filename: row.filename,
    storedPath: row.stored_path,
    mime: row.mime,
    size: row.size,
    uploadedAt: row.uploaded_at,
  });
}

/** Archivos de pacientes acotados al dueño (owner_user_id) de la sesión. */
export class SqlitePatientFileRepository implements PatientFileRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(file: PatientFile): Promise<void> {
    const primitives = file.toPrimitives();
    await this.db.execute(
      `INSERT INTO patient_files (id, patient_id, filename, stored_path, mime, size, uploaded_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           patient_id = excluded.patient_id,
           filename = excluded.filename,
           stored_path = excluded.stored_path,
           mime = excluded.mime,
           size = excluded.size,
           uploaded_at = excluded.uploaded_at,
           owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        primitives.filename,
        primitives.storedPath,
        primitives.mime,
        primitives.size,
        primitives.uploadedAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<PatientFile | null> {
    const row = await this.db.queryRow<PatientFileRow>(
      'SELECT * FROM patient_files WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<PatientFile[]> {
    const rows = await this.db.query<PatientFileRow>(
      'SELECT * FROM patient_files WHERE patient_id = ? AND owner_user_id = ? ORDER BY uploaded_at DESC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async totalSizeForOwner(): Promise<number> {
    const row = await this.db.queryRow<{ total: number }>(
      'SELECT COALESCE(SUM(size), 0) AS total FROM patient_files WHERE owner_user_id = ?',
      [this.ownerUserId],
    );
    return row ? Number(row.total) : 0;
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM patient_files WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
