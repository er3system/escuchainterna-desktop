import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalAnswers, ClinicalAnswerValue } from './ClinicalRecord';
import { SESSION_KIND_LABELS, type SessionKind } from './sessionTemplates';

/**
 * Ensamblador PURO (sin Node) del contenido de la "Historia clínica completa":
 * núcleo + bloques (secciones+respuestas de la historia consolidada) + Evolución
 * (TODAS las sesiones no archivadas, con su formulario base y sus bloques) +
 * diagnósticos, en markdown. Es DETERMINISTA: no usa IA. El resultado alimenta
 * tanto la vista viva "Documento" como el patient_report kind='expediente' firmable.
 */

export interface ExpedienteHistory {
  title: string;
  sections: ClinicalSection[];
  answers: ClinicalAnswers;
}

export interface ExpedienteSession {
  title: string;
  kind: SessionKind;
  templateId: string | null;
  date: string;
  content: string;
  answers: ClinicalAnswers;
  /** Secciones de la sesión: formulario base (1ª/seguimiento) + bloques añadidos. */
  sections: ClinicalSection[];
}

export interface ExpedienteDiagnosis {
  code: string;
  title: string;
  status: string;
  /** Naturaleza: 'hipotesis' (hipótesis diagnóstica) | 'formal' (diagnóstico formal). */
  kind: 'hipotesis' | 'formal';
}

export interface ExpedienteInput {
  generatedAt: string;
  patientName: string;
  birthDate: string | null;
  gender: string;
  professionalName: string;
  professionalLicense: string;
  history: ExpedienteHistory | null;
  /** Todas las sesiones no archivadas, en orden cronológico ascendente. */
  evolucion: ExpedienteSession[];
  diagnoses: ExpedienteDiagnosis[];
}

function flatValue(value: ClinicalAnswerValue | undefined): string {
  if (value === undefined) return '';
  return (Array.isArray(value) ? value.join(', ') : value).trim();
}

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Cuenta de respuestas no vacías de la historia (para detectar núcleo vacío). */
function answeredCount(history: ExpedienteHistory | null): number {
  if (!history) return 0;
  return history.sections
    .flatMap((section) => section.fields)
    .filter((field) => flatValue(history.answers[field.id]) !== '').length;
}

/** Campos respondidos de una sección (label + valor), omitiendo los vacíos. */
function answeredFields(
  section: ClinicalSection,
  answers: ClinicalAnswers,
): { label: string; value: string }[] {
  return section.fields
    .map((field) => ({ label: field.label, value: flatValue(answers[field.id]) }))
    .filter((entry) => entry.value !== '');
}

/** ¿La sesión tiene algún contenido (texto libre o algún campo respondido)? */
function sessionHasContent(session: ExpedienteSession): boolean {
  if (session.content.replace(/\s+/g, ' ').trim() !== '') return true;
  return session.sections.some((section) => answeredFields(section, session.answers).length > 0);
}

/**
 * Huecos estructurales del expediente. Ya NO se imprimen dentro del documento
 * firmable: se muestran como checklist "Antes de firmar" en la UI de Exportar
 * (recordatorio de pantalla, fuera del PDF). Función pura reutilizable.
 */
export function expedienteGaps(input: ExpedienteInput): string[] {
  const gaps: string[] = [];
  if (answeredCount(input.history) === 0) gaps.push('El núcleo de la historia clínica está vacío.');
  if (input.evolucion.length === 0) gaps.push('No hay sesiones registradas en la Evolución.');
  if (input.diagnoses.length === 0) gaps.push('No consta un diagnóstico CIE-11 registrado.');
  if (!input.birthDate) gaps.push('No consta la fecha de nacimiento del paciente.');
  if (!input.professionalLicense.trim())
    gaps.push('No consta la cédula/tarjeta profesional (requisito habitual para firmar).');
  return gaps;
}

export function buildExpedienteMarkdown(input: ExpedienteInput): string {
  const lines: string[] = [];

  lines.push(`# Historia clínica completa — ${input.patientName}`);
  lines.push('');
  lines.push(
    `**Profesional:** ${input.professionalName || '[completar]'}${input.professionalLicense ? ` · Cédula/Tarjeta profesional: ${input.professionalLicense}` : ''}`,
  );
  lines.push(
    `**Paciente:** ${input.patientName}${input.birthDate ? ` · Nacimiento: ${input.birthDate}` : ''}${input.gender ? ` · ${input.gender}` : ''}`,
  );
  lines.push(`**Documento generado:** ${shortDate(input.generatedAt)}`);
  lines.push('');

  // ---- Núcleo + bloques de la historia consolidada ----
  lines.push('## Historia clínica (núcleo y bloques)');
  if (!input.history || answeredCount(input.history) === 0) {
    lines.push('Sin contenido registrado en el núcleo de la historia.');
  } else {
    for (const section of input.history.sections) {
      const answered = answeredFields(section, input.history.answers);
      if (answered.length === 0) continue;
      lines.push('');
      lines.push(`### ${section.title}`);
      for (const entry of answered) lines.push(`- **${entry.label}:** ${entry.value}`);
    }
  }
  lines.push('');

  // ---- Evolución (TODAS las sesiones no archivadas, cronológico) ----
  // Cada sesión se vuelca completa: texto libre + formulario base + sus bloques.
  lines.push('## Evolución (sesiones)');
  if (input.evolucion.length === 0) {
    lines.push('No hay sesiones registradas en la historia clínica.');
  } else {
    for (const session of input.evolucion) {
      lines.push('');
      lines.push(`### ${shortDate(session.date)} · ${session.title} (${SESSION_KIND_LABELS[session.kind]})`);
      const free = session.content.replace(/\s+/g, ' ').trim();
      if (free) lines.push(free);
      for (const section of session.sections) {
        const answered = answeredFields(section, session.answers);
        if (answered.length === 0) continue;
        lines.push('');
        lines.push(`**${section.title}**`);
        for (const entry of answered) lines.push(`- **${entry.label}:** ${entry.value}`);
      }
      if (!sessionHasContent(session)) lines.push('(Sesión sin contenido registrado.)');
    }
  }
  lines.push('');

  // ---- Diagnósticos ----
  lines.push('## Diagnósticos (CIE-11)');
  if (input.diagnoses.length === 0) {
    lines.push('- Sin diagnósticos registrados.');
  } else {
    for (const diagnosis of input.diagnoses) {
      const naturaleza = diagnosis.kind === 'formal' ? 'diagnóstico formal' : 'hipótesis diagnóstica';
      lines.push(`- ${diagnosis.code} — ${diagnosis.title} (${diagnosis.status} · ${naturaleza})`);
    }
  }

  // Nota: los "huecos" del expediente (lo que no consta) ya NO se incluyen en el
  // documento firmable; se muestran como checklist en la UI de Exportar.
  return lines.join('\n');
}
