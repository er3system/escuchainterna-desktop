import type { PatientConsent } from '../PatientConsent';

/** Consentimientos de los pacientes del profesional en sesión (owner-scoped). */
export interface PatientConsentRepository {
  save(consent: PatientConsent): Promise<void>;
  findById(id: string): Promise<PatientConsent | null>;
  /** El consentimiento más reciente del paciente (el vigente para el badge). */
  findLatestByPatient(patientId: string): Promise<PatientConsent | null>;
  listByPatient(patientId: string): Promise<PatientConsent[]>;
}
