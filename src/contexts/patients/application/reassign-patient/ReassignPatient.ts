import { AssignPatient, type AssignPatientInput } from '../assign-patient/AssignPatient';
import type { PatientAssignmentRepository } from '../../domain/repositories/PatientAssignmentRepository';
import type { PatientOwnerWriter } from '../../domain/repositories/PatientOwnerWriter';
import type { AssignmentReason } from '../../domain/PatientAssignment';

export interface ReassignPatientInput {
  patientId: string;
  organizationId: string;
  /**
   * Nuevo tratante (su id) o null para RETENER en la institución (sin tratante).
   * Al retener, el dueño operativo pasa al custodio institucional `institutionUserId`.
   */
  tratanteUserId: string | null;
  /** Custodio de la institución (org_master) cuando se retiene sin tratante. */
  institutionUserId: string;
  supervisorUserId?: string | null;
  assignedBy: string;
  reason?: AssignmentReason;
}

/**
 * Reasigna un paciente institucional (§1.2, §3.3): mueve el ACCESO (owner_user_id +
 * asignación viva) sin tocar la PROPIEDAD (organization_id). Mantiene el invariante
 * owner_user_id == tratante de la asignación activa; al retener en la institución,
 * owner_user_id pasa al custodio (org_master) y la asignación queda 'institucion'
 * (tratante null). Reutiliza AssignPatient, que supersede la asignación viva previa.
 */
export class ReassignPatient {
  public constructor(
    private readonly owners: PatientOwnerWriter,
    private readonly assignments: PatientAssignmentRepository,
  ) {}

  public async execute(input: ReassignPatientInput): Promise<{ ok: boolean }> {
    // El dueño operativo es el nuevo tratante; si se retiene, el custodio institucional.
    const newOwner = input.tratanteUserId ?? input.institutionUserId;
    const moved = await this.owners.setOwner(input.patientId, input.organizationId, newOwner);
    if (!moved) return { ok: false }; // no existe o no es de esta organización

    const assignmentInput: AssignPatientInput = {
      patientId: input.patientId,
      organizationId: input.organizationId,
      tratanteUserId: input.tratanteUserId,
      supervisorUserId: input.supervisorUserId ?? null,
      assignedBy: input.assignedBy,
      reason: input.reason ?? 'reasignacion',
    };
    await new AssignPatient(this.assignments).execute(assignmentInput);
    return { ok: true };
  }
}
