// Módulo PURO (sin dependencias de Node): tipos y etiquetas de los reportes
// firmables del expediente (spec v2, sección 7).

export type PatientReportKind =
  | 'informe_clinico'
  | 'requerimiento_judicial'
  | 'constancia_atencion'
  | 'riesgo_derivacion'
  // Historia clínica completa: se ENSAMBLA desde el expediente (núcleo + bloques
  // + Evolución + diagnósticos), no la redacta la IA. Comparte la tubería de
  // firma/PDF, pero tiene su propia acción de generación.
  | 'expediente';

/** Tipos REDACTABLES por IA (selector del generador de reportes). Sin 'expediente'. */
export const PATIENT_REPORT_KINDS: PatientReportKind[] = [
  'informe_clinico',
  'requerimiento_judicial',
  'constancia_atencion',
  'riesgo_derivacion',
];

/** Todos los tipos válidos (incluye 'expediente', que se ensambla, no se redacta). */
export const ALL_PATIENT_REPORT_KINDS: PatientReportKind[] = [...PATIENT_REPORT_KINDS, 'expediente'];

export const PATIENT_REPORT_KIND_LABELS: Record<PatientReportKind, string> = {
  informe_clinico: 'Informe clínico general',
  requerimiento_judicial: 'Respuesta a requerimiento judicial / abogado',
  constancia_atencion: 'Constancia de atención',
  riesgo_derivacion: 'Reporte de riesgo / derivación',
  expediente: 'Historia clínica completa',
};

export const PATIENT_REPORT_KIND_DESCRIPTIONS: Record<PatientReportKind, string> = {
  informe_clinico:
    'Resumen del proceso terapéutico: motivo de consulta, evolución, diagnóstico y recomendaciones.',
  requerimiento_judicial:
    'Respuesta formal a un juzgado o abogado, limitada a lo solicitado y protegiendo el secreto profesional.',
  constancia_atencion:
    'Documento breve que certifica que la persona recibe o recibió atención psicológica.',
  riesgo_derivacion:
    'Comunica indicadores de riesgo y la derivación a otro servicio (psiquiatría, urgencias, trabajo social).',
  expediente:
    'Documento consolidado del expediente: núcleo de la historia, bloques por enfoque, evolución de las sesiones y diagnósticos.',
};

export type PatientReportStatus = 'borrador' | 'revisado' | 'firmado';

export const PATIENT_REPORT_STATUS_LABELS: Record<PatientReportStatus, string> = {
  borrador: 'Borrador',
  revisado: 'Revisado',
  firmado: 'Firmado',
};

export function isPatientReportKind(value: string): value is PatientReportKind {
  return (ALL_PATIENT_REPORT_KINDS as string[]).includes(value);
}
