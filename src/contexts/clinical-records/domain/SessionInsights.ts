/**
 * Puerto de inteligencia sobre notas de sesión y expediente.
 * Implementaciones: AnthropicSessionInsights (con ANTHROPIC_API_KEY) y
 * LocalSessionInsights (heurístico, sin red) — la app funciona 100% local.
 */

export interface SessionReport {
  ideasPrincipales: string[];
  intervencionesSugeridas: string[];
  preguntasSiguienteSesion: string[];
  resumen: string;
}

/** Foto de un campo de la historia clínica que la IA puede proponer cambiar. */
export interface RecordSnapshotField {
  fieldId: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  type: string;
  /** Valor actual aplanado (las listas se unen con coma). */
  currentValue: string;
}

export interface RecordSnapshot {
  recordId: string;
  title: string;
  templateName: string;
  fields: RecordSnapshotField[];
}

/** Propuesta de cambio campo a campo. NUNCA se aplica sin aprobación humana. */
export interface RecordUpdateProposal {
  fieldId: string;
  sectionId: string;
  label: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
}

/** Datos del paciente que alimentan el borrador de un reporte firmable. */
export interface PatientReportData {
  patientName: string;
  birthDate: string | null;
  gender: string;
  consultationReason: string;
  therapyStartDate: string | null;
  diagnoses: Array<{ code: string; title: string; status: string }>;
  sessionNotesCount: number;
  firstNoteAt: string | null;
  lastNoteAt: string | null;
  professionalName: string;
  professionalLicense: string;
}

/** Nota de sesión dentro del contexto de un caso supervisado (contenido en claro). */
export interface SupervisionCaseNote {
  title: string;
  content: string;
  createdAt: string;
}

export interface SupervisionCaseRecord {
  title: string;
  templateName: string;
  updatedAt: string;
}

export interface SupervisionCaseDiagnosis {
  code: string;
  title: string;
  status: string;
}

/**
 * Contexto del caso de un paciente de un SUPERVISADO, armado por un read model
 * que solo accede vía vínculo de supervisión vigente. Las secciones respetan
 * el alcance del vínculo (sin alcance de notas → `notes` vacío, etc.).
 */
export interface SupervisionCaseData {
  patientName: string;
  gender: string;
  birthDate: string | null;
  consultationReason: string;
  therapyStartDate: string | null;
  /** Nombre visible del profesional supervisado (autor del expediente). */
  supervisedName: string;
  diagnoses: SupervisionCaseDiagnosis[];
  /** Notas en orden cronológico ascendente. */
  notes: SupervisionCaseNote[];
  records: SupervisionCaseRecord[];
}

export interface SessionInsights {
  answerQuestion(notes: string, question: string): Promise<string>;
  generateSessionReport(notes: string): Promise<SessionReport>;
  /**
   * Propone cambios a la historia clínica a partir de una nota de sesión.
   * Solo puede referirse a campos existentes del snapshot; el caso de uso
   * guarda las propuestas y la UI exige aprobación explícita por campo.
   */
  suggestRecordUpdates(notes: string, record: RecordSnapshot): Promise<RecordUpdateProposal[]>;
  /**
   * Redacta el borrador de un reporte clínico/legal usando los datos del
   * paciente y los lineamientos normativos del país elegido. El resultado es
   * SIEMPRE un borrador: requiere revisión y firma del profesional.
   */
  draftPatientReport(kind: string, patientData: PatientReportData, countryGuidelines: string): Promise<string>;
  /**
   * Pule el texto de una nota de sesión y devuelve un BORRADOR editable (mejor
   * redactado y organizado), sin inventar hechos. Nunca se aplica solo: el
   * profesional revisa, edita y decide si reemplaza su texto.
   */
  polishNote(notes: string): Promise<string>;
  /**
   * Resumen estructurado del caso para SUPERVISIÓN académica (markdown):
   * qué se ha trabajado, técnicas/intervenciones registradas, evolución
   * temporal y estado de la historia clínica y diagnósticos. Es material del
   * supervisor: nunca se persiste en el expediente del estudiante.
   */
  summarizeCaseForSupervision(caseData: SupervisionCaseData): Promise<string>;
  providerName(): 'anthropic' | 'local';

  /**
   * Uso REAL (tokens facturables equivalentes, ya ajustados por caché) de la
   * ÚLTIMA operación ejecutada. Opcional: solo el adaptador remoto lo expone; el
   * medidor lo prefiere sobre su estimación por longitud. La fábrica crea una
   * instancia por petición, así que refleja la llamada recién resuelta.
   */
  lastUsage?(): { inputTokens: number; outputTokens: number } | null;
}
