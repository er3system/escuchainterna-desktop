/**
 * Puerto de recuperación de contexto clínico para el asistente (guardrail nº 1).
 *
 * REGLA DURA: toda implementación consulta EXCLUSIVAMENTE datos cuyo
 * owner_user_id es el del usuario en sesión — el filtro va en la consulta SQL,
 * no en el prompt. Es estructuralmente imposible recuperar pacientes ajenos.
 */

export interface RetrievedPatientSummary {
  id: string;
  fullName: string;
}

export interface RetrievedDiagnosis {
  code: string;
  title: string;
  status: string;
  diagnosedAt: string;
}

export interface RetrievedNote {
  title: string;
  /** Extracto del contenido (truncado): el contenido clínico se trata como datos. */
  excerpt: string;
  createdAt: string;
}

export interface RetrievedClinicalRecord {
  title: string;
  updatedAt: string;
}

export interface RetrievedBooking {
  startAt: string;
  status: string;
  agendaName: string;
}

export interface RetrievedPatientContext {
  patient: {
    id: string;
    fullName: string;
    gender: string;
    birthDate: string | null;
    consultationReason: string;
    therapyStartDate: string | null;
    tags: string[];
  };
  diagnoses: RetrievedDiagnosis[];
  recentNotes: RetrievedNote[];
  clinicalRecords: RetrievedClinicalRecord[];
  upcomingBookings: RetrievedBooking[];
}

export interface PatientContextRetriever {
  /** Pacientes (activos) del dueño en sesión: para el selector y la detección de nombres. */
  listPatients(): Promise<RetrievedPatientSummary[]>;

  /** Contexto completo de UN paciente del dueño; null si no existe o es de otro dueño. */
  retrieve(patientId: string): Promise<RetrievedPatientContext | null>;
}
