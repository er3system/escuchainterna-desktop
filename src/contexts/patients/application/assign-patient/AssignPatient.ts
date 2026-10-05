import { randomUUID } from 'node:crypto';
import {
  PatientAssignment,
  type AssignmentReason,
} from '../../domain/PatientAssignment';
import type { PatientAssignmentRepository } from '../../domain/repositories/PatientAssignmentRepository';

export interface AssignPatientInput {
  patientId: string;
  organizationId: string;
  /** null = retenido por la institución (sin tratante humano). */
  tratanteUserId: string | null;
  supervisorUserId?: string | null;
  assignedBy: string;
  reason: AssignmentReason;
}

/**
 * Crea una asignación viva de un paciente institucional (§1.2). Si ya había una
 * asignación viva, la supersede primero (cierra a 'reasignada') para mantener el
 * invariante de UNA sola fila no-'reasignada' y conservar la historia de custodia.
 * Reutilizable por el alta, la reasignación manual (H6) y el offboarding (H7).
 */
export class AssignPatient {
  public constructor(private readonly assignments: PatientAssignmentRepository) {}

  public async execute(input: AssignPatientInput): Promise<string> {
    const current = await this.assignments.findLiveByPatient(input.patientId);
    if (current) {
      current.supersede();
      await this.assignments.save(current);
    }
    const assignment = PatientAssignment.assign({
      id: randomUUID(),
      patientId: input.patientId,
      organizationId: input.organizationId,
      tratanteUserId: input.tratanteUserId,
      supervisorUserId: input.supervisorUserId ?? null,
      assignedBy: input.assignedBy,
      reason: input.reason,
    });
    await this.assignments.save(assignment);
    return assignment.assignmentId();
  }
}
