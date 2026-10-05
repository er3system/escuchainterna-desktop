import type { PatientAssignment } from '../PatientAssignment';

/**
 * Asignaciones acotadas a una organización (organization_id) — un paciente
 * institucional pertenece a una sola organización, que es la frontera de esta capa.
 */
export interface PatientAssignmentRepository {
  save(assignment: PatientAssignment): Promise<void>;
  /** La asignación viva del paciente (status != 'reasignada'), o null. */
  findLiveByPatient(patientId: string): Promise<PatientAssignment | null>;
  /** Historia completa de custodia del paciente (más reciente primero). */
  listByPatient(patientId: string): Promise<PatientAssignment[]>;
  /** Asignaciones vivas con un tratante dado (para offboarding y vistas de carga). */
  listLiveByTratante(tratanteUserId: string): Promise<PatientAssignment[]>;
  /** Asignaciones vivas de la organización (para la vista del org_master). */
  listLiveByOrganization(): Promise<PatientAssignment[]>;
}
