import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { PatientReport } from '../../domain/PatientReport';
import { isPatientReportKind, type PatientReportStatus } from '../../domain/value-objects/patientReportKinds';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';

interface PatientReportRow {
  id: string;
  patient_id: string;
  kind: string;
  title: string;
  content: string;
  status: string;
  signed_by: string;
  license_number: string;
  signed_by_user_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toStatus(value: string): PatientReportStatus {
  return value === 'firmado' || value === 'revisado' ? value : 'borrador';
}

function toAggregate(row: PatientReportRow): PatientReport {
  return PatientReport.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    kind: isPatientReportKind(row.kind) ? row.kind : 'informe_clinico',
    title: row.title,
    // Cifrado at-rest (v3 §1.1): el contenido del reporte se descifra al leer.
    content: decryptField(row.content),
    status: toStatus(row.status),
    signedBy: row.signed_by,
    licenseNumber: row.license_number,
    signedByUserId: row.signed_by_user_id ?? '',
    signedAt: row.signed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Reportes clínico-legales firmables acotados al dueño de la sesión. */
export class SqlitePatientReportRepository implements PatientReportRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(report: PatientReport): Promise<void> {
    const primitives = report.toPrimitives();
    await this.db.execute(
      `INSERT INTO patient_reports
           (id, patient_id, owner_user_id, kind, title, content, status, signed_by, license_number, signed_by_user_id, signed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           status = excluded.status,
           signed_by = excluded.signed_by,
           license_number = excluded.license_number,
           signed_by_user_id = excluded.signed_by_user_id,
           signed_at = excluded.signed_at,
           updated_at = excluded.updated_at
         WHERE patient_reports.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        this.ownerUserId,
        primitives.kind,
        primitives.title,
        encryptField(primitives.content),
        primitives.status,
        primitives.signedBy,
        primitives.licenseNumber,
        primitives.signedByUserId,
        primitives.signedAt,
        primitives.createdAt,
        primitives.updatedAt,
      ],
    );
  }

  public async findById(id: string): Promise<PatientReport | null> {
    const row = await this.db.queryRow<PatientReportRow>(
      'SELECT * FROM patient_reports WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<PatientReport[]> {
    const rows = await this.db.query<PatientReportRow>(
      'SELECT * FROM patient_reports WHERE patient_id = ? AND owner_user_id = ? ORDER BY updated_at DESC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM patient_reports WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
