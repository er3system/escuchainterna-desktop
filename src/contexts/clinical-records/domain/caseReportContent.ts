/**
 * Ensamblador PURO (sin Node) del informe FIRMABLE de un caso relacional, por
 * MIEMBRO: contiene las sesiones conjuntas (compartidas) + las individuales NO
 * confidenciales de ESE miembro. Nunca el material privado del otro miembro ni
 * contenido confidencial (la selección segura la hace BuildCaseExport, §10).
 * Determinista: se guarda como patient_report kind='expediente' firmable.
 */

import { MEMBER_RELATION_LABELS, isMemberRelationQuality } from './value-objects/caseProfile';

export interface CaseReportSessionEntry {
  title: string;
  content: string;
  createdAt: string;
}

export interface CaseReportSystemEval {
  lifeCycleStage: string;
  structure: string;
  communication: string;
  systemMotive: string;
}

export interface CaseReportRelation {
  a: string;
  b: string;
  quality: string;
  note: string;
}

export interface CaseMemberReportInput {
  caseTitle: string;
  memberName: string;
  secretsPolicy: string;
  generatedAt: string;
  /** Perfil del sistema (opcional; se omite del informe lo que esté vacío). */
  systemEval?: CaseReportSystemEval;
  objectives?: string;
  events?: { date: string; title: string; note: string }[];
  relations?: CaseReportRelation[];
  jointSessions: CaseReportSessionEntry[];
  individualSessions: CaseReportSessionEntry[];
}

const SECRETS_LABEL: Record<string, string> = {
  '': 'sin definir',
  no_secretos: 'sin secretos',
  confidencialidad_limitada: 'confidencialidad limitada',
};

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

function renderSessions(lines: string[], sessions: CaseReportSessionEntry[], empty: string): void {
  if (sessions.length === 0) {
    lines.push(empty);
    return;
  }
  for (const session of sessions) {
    lines.push('');
    lines.push(`### ${shortDate(session.createdAt)} · ${session.title}`);
    lines.push(session.content.trim() || '(Sesión sin contenido registrado.)');
  }
}

export function buildCaseMemberReportMarkdown(input: CaseMemberReportInput): string {
  const lines: string[] = [];

  lines.push(`# Informe del caso — ${input.memberName}`);
  lines.push('');
  lines.push(`**Caso:** ${input.caseTitle}`);
  lines.push(`**Política de secretos:** ${SECRETS_LABEL[input.secretsPolicy] ?? input.secretsPolicy}`);
  lines.push(`**Documento generado:** ${shortDate(input.generatedAt)}`);
  lines.push('');
  lines.push(
    `> Este documento reúne las sesiones conjuntas del caso y las sesiones individuales no confidenciales de ${input.memberName}. No incluye contenido confidencial ni el material privado del otro miembro.`,
  );
  lines.push('');

  // ---- Perfil del sistema (solo lo que tenga contenido) ----
  const se = input.systemEval;
  const seEntries: [string, string][] = se
    ? [
        ['Etapa del ciclo vital familiar', se.lifeCycleStage],
        ['Estructura (límites, jerarquías, alianzas)', se.structure],
        ['Patrones de comunicación', se.communication],
        ['Motivo de consulta del sistema', se.systemMotive],
      ].filter(([, value]) => value.trim() !== '') as [string, string][]
    : [];
  if (seEntries.length > 0) {
    lines.push('## Evaluación del sistema');
    for (const [label, value] of seEntries) lines.push(`- **${label}:** ${value}`);
    lines.push('');
  }

  if (input.objectives && input.objectives.trim() !== '') {
    lines.push('## Objetivos del caso');
    lines.push(input.objectives.trim());
    lines.push('');
  }

  const events = (input.events ?? []).filter((e) => e.title.trim() !== '' || e.date.trim() !== '');
  if (events.length > 0) {
    lines.push('## Línea de tiempo del sistema');
    for (const event of events) {
      const datePart = event.date.trim() ? `${event.date.trim()} — ` : '';
      const notePart = event.note.trim() ? ` (${event.note.trim()})` : '';
      lines.push(`- ${datePart}${event.title.trim()}${notePart}`);
    }
    lines.push('');
  }

  const relations = input.relations ?? [];
  if (relations.length > 0) {
    lines.push('## Mapa de relaciones');
    for (const rel of relations) {
      const quality = isMemberRelationQuality(rel.quality) ? MEMBER_RELATION_LABELS[rel.quality] : rel.quality;
      const notePart = rel.note.trim() ? ` — ${rel.note.trim()}` : '';
      lines.push(`- **${rel.a} ↔ ${rel.b}:** ${quality}${notePart}`);
    }
    lines.push('');
  }

  lines.push('## Sesiones conjuntas (compartidas)');
  renderSessions(lines, input.jointSessions, 'Sin sesiones conjuntas registradas.');
  lines.push('');

  lines.push(`## Sesiones individuales de ${input.memberName}`);
  renderSessions(lines, input.individualSessions, 'Sin sesiones individuales en el informe.');

  return lines.join('\n');
}
