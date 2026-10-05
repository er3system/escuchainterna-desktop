import { AggregateRoot } from '@/shared/domain/AggregateRoot';

/**
 * Estado de una asignación de paciente institucional (docs/cuentas-institucionales-spec.md §1.2).
 * - 'activa'      = fila viva con tratante humano asignado.
 * - 'institucion' = fila viva pero retenida por la organización, SIN tratante
 *                   (tratanteUserId == null); el custodio es el org_master.
 * - 'reasignada'  = fila histórica, superada por una posterior (auditoría de custodia).
 * En todo momento un paciente institucional tiene EXACTAMENTE una fila no-'reasignada'.
 */
export type AssignmentStatus = 'activa' | 'reasignada' | 'institucion';

/** Motivo por el que se creó la asignación (para la bitácora de custodia). */
export type AssignmentReason = 'alta' | 'reasignacion' | 'offboarding' | 'manual';

const ASSIGNMENT_REASONS: AssignmentReason[] = ['alta', 'reasignacion', 'offboarding', 'manual'];

export function isAssignmentReason(value: unknown): value is AssignmentReason {
  return (ASSIGNMENT_REASONS as string[]).includes(value as string);
}

export interface PatientAssignmentPrimitives {
  id: string;
  patientId: string;
  organizationId: string;
  /** null = retenido por la institución (sin tratante humano). */
  tratanteUserId: string | null;
  /** Profesor responsable; null si aún no asignado. */
  supervisorUserId: string | null;
  status: AssignmentStatus;
  assignedBy: string;
  reason: AssignmentReason;
  createdAt: string;
}

/**
 * Asignación de un paciente institucional a su tratante (acceso operativo) y a su
 * supervisor. Es la capa de ACCESO, separada de la PROPIEDAD (la organización, en
 * patients.organization_id). La continuidad institucional es reasignar el registro
 * vivo —cambiar quién accede—, nunca exportar a PDF (§4). El puntero operativo que
 * filtran todas las queries sigue siendo patients.owner_user_id; esta entidad es el
 * registro autoritativo + la historia de custodia.
 */
export class PatientAssignment extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly organizationId: string,
    private readonly tratanteUserId: string | null,
    private readonly supervisorUserId: string | null,
    private status: AssignmentStatus,
    private readonly assignedBy: string,
    private readonly reason: AssignmentReason,
    private readonly createdAt: Date,
  ) {
    super();
  }

  /**
   * Crea una asignación viva. Si hay tratante humano → 'activa'; si no → 'institucion'
   * (retenida por la organización). Un valor de status explícito jamás se acepta desde
   * fuera: lo deriva el dominio del propio tratante para mantener el invariante.
   */
  public static assign(input: {
    id: string;
    patientId: string;
    organizationId: string;
    tratanteUserId: string | null;
    supervisorUserId?: string | null;
    assignedBy: string;
    reason: AssignmentReason;
  }): PatientAssignment {
    const tratante = input.tratanteUserId && input.tratanteUserId.trim() ? input.tratanteUserId : null;
    return new PatientAssignment(
      input.id,
      input.patientId,
      input.organizationId,
      tratante,
      input.supervisorUserId && input.supervisorUserId.trim() ? input.supervisorUserId : null,
      tratante ? 'activa' : 'institucion',
      input.assignedBy,
      input.reason,
      new Date(),
    );
  }

  public static fromPrimitives(primitives: PatientAssignmentPrimitives): PatientAssignment {
    return new PatientAssignment(
      primitives.id,
      primitives.patientId,
      primitives.organizationId,
      primitives.tratanteUserId,
      primitives.supervisorUserId,
      primitives.status,
      primitives.assignedBy,
      primitives.reason,
      new Date(primitives.createdAt),
    );
  }

  public assignmentId(): string {
    return this.id;
  }

  public assignedPatientId(): string {
    return this.patientId;
  }

  public organization(): string {
    return this.organizationId;
  }

  public tratante(): string | null {
    return this.tratanteUserId;
  }

  public supervisor(): string | null {
    return this.supervisorUserId;
  }

  /** ¿Es la fila viva (no fue superada por otra)? */
  public isLive(): boolean {
    return this.status !== 'reasignada';
  }

  /** ¿Está retenido por la institución (sin tratante humano)? */
  public isHeldByInstitution(): boolean {
    return this.status === 'institucion';
  }

  /** Cierra esta asignación al ser superada por una posterior (auditoría de custodia). */
  public supersede(): void {
    this.status = 'reasignada';
  }

  public toPrimitives(): PatientAssignmentPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      organizationId: this.organizationId,
      tratanteUserId: this.tratanteUserId,
      supervisorUserId: this.supervisorUserId,
      status: this.status,
      assignedBy: this.assignedBy,
      reason: this.reason,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
