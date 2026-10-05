/**
 * Puerto de solo-lectura/escritura puntual hacia los datos del paciente.
 * El expediente clínico no depende del contexto patients: lee la tabla
 * `patients` a través de este puerto (read model propio).
 */
/** Campo personalizado arbitrario de la ficha (Tier B): etiqueta + valor. */
export interface PatientCustomField {
  label: string;
  value: string;
}

export interface PatientSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string | null;
  gender: string;
  consultationReason: string;
  therapyStartDate: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  tags: string[];
  /** Documento de identificación (§5): tipo + número. */
  documentType: string;
  documentNumber: string;
  /** Representante legal (acudiente): nombre + parentesco + documento. '' = sin representante. */
  guardianName: string;
  guardianRelationship: string;
  guardianDocument: string;
  /** Contexto clínico-médico (P5): medicación, antecedentes, encuadre, estado. */
  currentMedication: string;
  medicalHistory: string;
  sessionFrequency: string;
  sessionModality: string;
  processStatus: string;
  /** Cierre del proceso (Tier B): fecha de fin + motivo de finalización. */
  treatmentEndDate: string | null;
  treatmentEndReason: string;
  /** Administrativo/intake (Tier B): seguro + nº de póliza + derivación. */
  insuranceName: string;
  insurancePolicyNumber: string;
  referralSource: string;
  /** Campos personalizados que define el profesional (Tier B). */
  customFields: PatientCustomField[];
  archived: boolean;
  createdAt: string;
}

export interface PatientSummaryUpdate {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string | null;
  gender: string;
  consultationReason: string;
  therapyStartDate: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  tags: string[];
  documentType: string;
  documentNumber: string;
  guardianName: string;
  guardianRelationship: string;
  guardianDocument: string;
  currentMedication: string;
  medicalHistory: string;
  sessionFrequency: string;
  sessionModality: string;
  processStatus: string;
  treatmentEndDate: string | null;
  treatmentEndReason: string;
  insuranceName: string;
  insurancePolicyNumber: string;
  referralSource: string;
  customFields: PatientCustomField[];
}

export interface PatientDirectory {
  findSummary(patientId: string): Promise<PatientSummary | null>;
  updateSummary(patientId: string, update: PatientSummaryUpdate): Promise<void>;
  /**
   * Dedupe (§5.6): nombre del paciente que ya tiene ese número de documento bajo el
   * mismo dueño, excluyendo `exceptPatientId`. Devuelve null si no hay duplicado o si
   * el número está vacío. Es un AVISO (no bloquea ni impone UNIQUE).
   */
  findDuplicateByDocument(
    documentNumber: string,
    exceptPatientId?: string,
  ): Promise<{ id: string; fullName: string } | null>;
}
