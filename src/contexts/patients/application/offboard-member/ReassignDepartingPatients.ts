import { ReassignPatient } from '../reassign-patient/ReassignPatient';
import type { PatientAssignmentRepository } from '../../domain/repositories/PatientAssignmentRepository';
import type { PatientOwnerWriter } from '../../domain/repositories/PatientOwnerWriter';
import type { InstitutionalPatientReader } from '../../domain/repositories/InstitutionalPatientReader';

/** Resuelve el supervisor ACTIVO de un usuario en una organización (o null). */
export interface ActiveSupervisorResolver {
  findActiveSupervisor(supervisedUserId: string, organizationId?: string): Promise<string | null>;
}

export interface ReassignDepartingInput {
  organizationId: string;
  leavingUserId: string;
  /** Custodio de la institución (org_master) si no hay supervisor activo (§3.3). */
  institutionUserId: string;
  actorUserId: string;
}

export interface ReassignDepartingResult {
  reassignedCount: number;
  /** A dónde fue la cartera: al supervisor activo o, si no había, a la institución. */
  target: 'supervisor' | 'institucion';
  supervisorUserId: string | null;
}

/**
 * Reasigna TODA la cartera institucional de un miembro que se va (§3.2). Regla por
 * defecto: pasa al SUPERVISOR ACTIVO del que se va; si no hay supervisor activo
 * (ninguno o también inactivo), pasa a la INSTITUCIÓN (sin tratante). Ningún paciente
 * queda huérfano. NO desactiva la cuenta (eso lo orquesta el llamador, "desactivar, no
 * borrar"). Reutiliza ReassignPatient (mueve owner + supersede la asignación viva).
 */
export class ReassignDepartingPatients {
  public constructor(
    private readonly patients: InstitutionalPatientReader,
    private readonly owners: PatientOwnerWriter,
    private readonly assignments: PatientAssignmentRepository,
    private readonly supervisors: ActiveSupervisorResolver,
  ) {}

  public async execute(input: ReassignDepartingInput): Promise<ReassignDepartingResult> {
    const supervisor = await this.supervisors.findActiveSupervisor(
      input.leavingUserId,
      input.organizationId,
    );
    const patientIds = await this.patients.listInstitutionalPatientIds(
      input.organizationId,
      input.leavingUserId,
    );
    const reassign = new ReassignPatient(this.owners, this.assignments);

    let reassignedCount = 0;
    // for..of + await (NUNCA Promise.all): cada reasignación cascadea dueño dentro de la
    // misma transacción del caller; el orden y la atomicidad importan.
    for (const patientId of patientIds) {
      const result = await reassign.execute({
        patientId,
        organizationId: input.organizationId,
        tratanteUserId: supervisor, // null ⇒ retenido por la institución (§3.3)
        institutionUserId: input.institutionUserId,
        supervisorUserId: null,
        assignedBy: input.actorUserId,
        reason: 'offboarding',
      });
      if (result.ok) reassignedCount += 1;
    }

    return {
      reassignedCount,
      target: supervisor ? 'supervisor' : 'institucion',
      supervisorUserId: supervisor,
    };
  }
}
