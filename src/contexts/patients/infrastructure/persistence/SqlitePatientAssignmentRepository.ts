import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  PatientAssignment,
  type AssignmentReason,
  type AssignmentStatus,
} from '../../domain/PatientAssignment';
import type { PatientAssignmentRepository } from '../../domain/repositories/PatientAssignmentRepository';

interface PatientAssignmentRow {
  id: string;
  patient_id: string;
  organization_id: string;
  tratante_user_id: string | null;
  supervisor_user_id: string | null;
  status: string;
  assigned_by: string;
  reason: string;
  created_at: string;
}

function toAggregate(row: PatientAssignmentRow): PatientAssignment {
  return PatientAssignment.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    organizationId: row.organization_id,
    tratanteUserId: row.tratante_user_id,
    supervisorUserId: row.supervisor_user_id,
    status: (row.status as AssignmentStatus) || 'activa',
    assignedBy: row.assigned_by,
    reason: (row.reason as AssignmentReason) || 'alta',
    createdAt: row.created_at,
  });
}

/**
 * Asignaciones de pacientes institucionales, acotadas a una organización
 * (organization_id es la frontera de esta capa, §1.2). El puntero operativo de acceso
 * sigue viviendo en patients.owner_user_id; esta tabla es el registro autoritativo.
 */
export class SqlitePatientAssignmentRepository implements PatientAssignmentRepository {
  public constructor(
    private readonly organizationId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(assignment: PatientAssignment): Promise<void> {
    const p = assignment.toPrimitives();
    await this.db.execute(
      `INSERT INTO patient_assignments (id, patient_id, organization_id, tratante_user_id, supervisor_user_id, status, assigned_by, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status
         WHERE patient_assignments.organization_id = excluded.organization_id`,
      [
        p.id,
        p.patientId,
        p.organizationId,
        p.tratanteUserId,
        p.supervisorUserId,
        p.status,
        p.assignedBy,
        p.reason,
        p.createdAt,
      ],
    );
  }

  public async findLiveByPatient(patientId: string): Promise<PatientAssignment | null> {
    const row = await this.db.queryRow<PatientAssignmentRow>(
      `SELECT * FROM patient_assignments
         WHERE patient_id = ? AND organization_id = ? AND status != 'reasignada'
         ORDER BY created_at DESC LIMIT 1`,
      [patientId, this.organizationId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<PatientAssignment[]> {
    const rows = await this.db.query<PatientAssignmentRow>(
      `SELECT * FROM patient_assignments
         WHERE patient_id = ? AND organization_id = ?
         ORDER BY created_at DESC`,
      [patientId, this.organizationId],
    );
    return rows.map(toAggregate);
  }

  public async listLiveByTratante(tratanteUserId: string): Promise<PatientAssignment[]> {
    const rows = await this.db.query<PatientAssignmentRow>(
      `SELECT * FROM patient_assignments
         WHERE tratante_user_id = ? AND organization_id = ? AND status != 'reasignada'
         ORDER BY created_at DESC`,
      [tratanteUserId, this.organizationId],
    );
    return rows.map(toAggregate);
  }

  public async listLiveByOrganization(): Promise<PatientAssignment[]> {
    const rows = await this.db.query<PatientAssignmentRow>(
      `SELECT * FROM patient_assignments
         WHERE organization_id = ? AND status != 'reasignada'
         ORDER BY created_at DESC`,
      [this.organizationId],
    );
    return rows.map(toAggregate);
  }
}
