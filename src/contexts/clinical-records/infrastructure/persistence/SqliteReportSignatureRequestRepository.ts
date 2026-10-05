import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import {
  ReportSignatureRequest,
  type SignatureRequestStatus,
} from '../../domain/ReportSignatureRequest';
import type { ReportSignatureRequestRepository } from '../../domain/repositories/ReportSignatureRequestRepository';

interface RequestRow {
  id: string;
  report_id: string;
  patient_id: string;
  requester_user_id: string;
  supervisor_user_id: string;
  organization_id: string;
  status: string;
  note: string;
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
}

function toStatus(value: string): SignatureRequestStatus {
  return value === 'firmado' || value === 'rechazado' || value === 'cancelado' ? value : 'pendiente';
}

function toAggregate(row: RequestRow): ReportSignatureRequest {
  return ReportSignatureRequest.fromPrimitives({
    id: row.id,
    reportId: row.report_id,
    patientId: row.patient_id,
    requesterUserId: row.requester_user_id,
    supervisorUserId: row.supervisor_user_id,
    organizationId: row.organization_id,
    status: toStatus(row.status),
    // Texto libre cifrado at-rest (puede contener datos clínicos/identificatorios).
    note: row.note ? decryptField(row.note) : '',
    resolutionNote: row.resolution_note ? decryptField(row.resolution_note) : '',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  });
}

/** Solicitudes de co-firma. Artefacto entre dos partes: sin acotado por owner único. */
export class SqliteReportSignatureRequestRepository implements ReportSignatureRequestRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(request: ReportSignatureRequest): Promise<void> {
    const p = request.toPrimitives();
    await this.db.execute(
      `INSERT INTO report_signature_requests
           (id, report_id, patient_id, requester_user_id, supervisor_user_id, organization_id, status, note, resolution_note, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           resolution_note = excluded.resolution_note,
           resolved_at = excluded.resolved_at`,
      [
        p.id,
        p.reportId,
        p.patientId,
        p.requesterUserId,
        p.supervisorUserId,
        p.organizationId,
        p.status,
        p.note ? encryptField(p.note) : '',
        p.resolutionNote ? encryptField(p.resolutionNote) : '',
        p.createdAt,
        p.resolvedAt,
      ],
    );
  }

  public async findById(id: string): Promise<ReportSignatureRequest | null> {
    const row = await this.db.queryRow<RequestRow>(
      'SELECT * FROM report_signature_requests WHERE id = ?',
      [id],
    );
    return row ? toAggregate(row) : null;
  }

  public async findPendingByReport(reportId: string): Promise<ReportSignatureRequest | null> {
    const row = await this.db.queryRow<RequestRow>(
      "SELECT * FROM report_signature_requests WHERE report_id = ? AND status = 'pendiente' ORDER BY created_at DESC LIMIT 1",
      [reportId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listPendingForSupervisor(
    supervisorUserId: string,
  ): Promise<ReportSignatureRequest[]> {
    const rows = await this.db.query<RequestRow>(
      "SELECT * FROM report_signature_requests WHERE supervisor_user_id = ? AND status = 'pendiente' ORDER BY created_at ASC",
      [supervisorUserId],
    );
    return rows.map(toAggregate);
  }
}
