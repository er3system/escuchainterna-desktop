/**
 * Citas a la fuente + análisis de huecos (idea adoptada de gbrain, SIN su
 * stack: nada de vector DB ni embeddings). Módulo PURO — sin dependencias de
 * Node, importable desde client y server.
 *
 * Recibe evidencia YA recuperada y filtrada por owner_user_id (la seguridad de
 * aislamiento vive en la query SQL, no aquí) y produce: (1) una lista numerada
 * de fuentes citables y (2) los huecos explícitos del caso. La IA debe citar
 * estas fuentes y declarar estos huecos en vez de inventar o aparentar
 * completitud.
 */

export type EvidenceKind = 'nota' | 'diagnostico' | 'historia' | 'cita';

export interface EvidenceItem {
  kind: EvidenceKind;
  /** Etiqueta breve para citar, p. ej. "Nota del 12 jun 2026 — Encuadre". */
  label: string;
  /** Contenido literal que respalda lo que la IA puede afirmar. */
  detail: string;
}

export interface CaseEvidenceInput {
  notes: Array<{ title: string; date: string; content: string }>;
  diagnoses: Array<{ code: string; title: string; status: string }>;
  records: Array<{ title: string; date: string }>;
  upcomingAppointments: Array<{ date: string }>;
}

export interface CaseEvidence {
  /** Fuentes citables, numeradas desde 1 en el orden de esta lista. */
  sources: EvidenceItem[];
  /** Lo que el caso NO tiene registrado (previene falsa confianza). */
  gaps: string[];
  hasAnyEvidence: boolean;
}

export function buildCaseEvidence(input: CaseEvidenceInput): CaseEvidence {
  const sources: EvidenceItem[] = [];
  const gaps: string[] = [];

  for (const diagnosis of input.diagnoses) {
    sources.push({
      kind: 'diagnostico',
      label: `Diagnóstico ${diagnosis.code} — ${diagnosis.title} (${diagnosis.status})`,
      detail: `${diagnosis.code} — ${diagnosis.title} (${diagnosis.status})`,
    });
  }
  for (const record of input.records) {
    sources.push({ kind: 'historia', label: `Historia clínica: ${record.title} (${record.date})`, detail: record.title });
  }
  for (const note of input.notes) {
    sources.push({
      kind: 'nota',
      label: `Nota del ${note.date} — ${note.title}`,
      detail: note.content,
    });
  }

  if (input.notes.length === 0) gaps.push('No hay notas de sesión registradas.');
  if (input.diagnoses.length === 0) gaps.push('No hay un diagnóstico CIE-11 registrado.');
  if (input.records.length === 0) gaps.push('No hay historia clínica registrada.');
  if (input.upcomingAppointments.length === 0) gaps.push('No hay próximas citas agendadas.');

  return { sources, gaps, hasAnyEvidence: sources.length > 0 };
}

/** Bloque de fuentes numeradas para inyectar en el prompt; la IA cita por [n]. */
export function formatSourcesForPrompt(evidence: CaseEvidence): string {
  if (evidence.sources.length === 0) return '(Sin fuentes registradas para este paciente.)';
  return evidence.sources.map((source, index) => `[${index + 1}] ${source.label}: ${source.detail}`).join('\n');
}

/** Línea de huecos para el prompt y para mostrar al profesional. */
export function formatGaps(evidence: CaseEvidence): string {
  if (evidence.gaps.length === 0) return '';
  return evidence.gaps.map((gap) => `- ${gap}`).join('\n');
}

/** Instrucción común de citado + huecos para los system prompts de IA. */
export const EVIDENCE_PROMPT_RULES = [
  'Cita la fuente de cada afirmación con su número entre corchetes, p. ej. [1], [2], al final de la frase que respalda.',
  'No afirmes nada que no esté en las fuentes; si un dato no aparece, dilo explícitamente.',
  'Cierra con una sección "Lo que no consta en el expediente" listando los huecos indicados; nunca los rellenes por inferencia.',
].join(' ');
