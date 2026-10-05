/**
 * Escritura puntual del DUEÑO operativo de un paciente institucional (§1.2). Cambiar
 * owner_user_id es el puntero de acceso vivo que filtran todas las consultas; la
 * reasignación lo mueve sin tocar la propiedad (organization_id). Acotado por
 * organización: solo se reasignan pacientes de ESA organización.
 */
export interface PatientOwnerWriter {
  /** Devuelve true si reasignó (el paciente existía y pertenecía a la organización). */
  setOwner(patientId: string, organizationId: string, newOwnerUserId: string): Promise<boolean>;
}
