/**
 * Read model del diagnóstico activo más reciente por paciente (spec v2 §6.11):
 * alimenta la pestaña Resumen y la columna Diagnóstico de la lista de pacientes.
 */
export interface ActiveDiagnosisSummary {
  patientId: string;
  cie11Code: string;
  cie11Title: string;
  /** Naturaleza: 'hipotesis' (hipótesis diagnóstica) | 'formal' (diagnóstico formal). */
  kind: 'hipotesis' | 'formal';
  diagnosedAt: string;
}

export interface ActiveDiagnosisReader {
  /** Diagnóstico activo más reciente de un paciente (o null). */
  latestForPatient(patientId: string): Promise<ActiveDiagnosisSummary | null>;
  /** Mapa patientId → diagnóstico activo más reciente, de todos los pacientes del owner. */
  latestForAllPatients(): Promise<Map<string, ActiveDiagnosisSummary>>;
}
