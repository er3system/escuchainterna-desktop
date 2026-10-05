/**
 * Lectura de los pacientes institucionales de un dueño dentro de una organización
 * (§3.2). Lee de la tabla `patients` (la fuente de verdad del dueño operativo), no de
 * las asignaciones, para que el offboarding capture TODA la cartera —aunque algún
 * paciente no tuviera fila de asignación— y ninguno quede huérfano.
 */
export interface InstitutionalPatientReader {
  /** Ids de los pacientes de la organización cuyo dueño operativo es `ownerUserId`. */
  listInstitutionalPatientIds(organizationId: string, ownerUserId: string): Promise<string[]>;
}
