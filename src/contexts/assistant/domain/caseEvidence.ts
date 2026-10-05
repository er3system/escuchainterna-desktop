/**
 * Puente entre el contexto clínico recuperado (acotado por owner_user_id) y el
 * módulo PURO de citas + huecos (`shared/domain/clinicalEvidence`). Idea
 * adoptada de gbrain SIN su stack: nada de vector DB ni embeddings.
 *
 * Módulo PURO (sin dependencias de Node): lo importan los motores del asistente
 * (server) y también el client component de la UI para PARSEAR la respuesta y
 * pintar las fuentes/huecos. Por eso el formato de las secciones vive aquí, en
 * un solo sitio, y es estable entre el motor con-API y el local.
 */

import {
  buildCaseEvidence,
  formatGaps,
  type CaseEvidence,
  type CaseEvidenceInput,
} from '@/shared/domain/clinicalEvidence';
import type { RetrievedPatientContext } from './PatientContextRetriever';

/** Encabezados estables: el motor los EMITE y la UI los PARSEA (un solo origen). */
export const SOURCES_HEADING = 'Fuentes';
export const GAPS_HEADING = 'Lo que no consta en el expediente';

/** Fecha legible en español (sin date-fns: este módulo es puro/cliente-seguro). */
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function spanishDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`;
}

/**
 * Mapea el contexto YA recuperado (y filtrado por owner en SQL) al input del
 * módulo de evidencia. Las fechas se humanizan aquí para que las etiquetas de
 * las fuentes salgan legibles ("Nota del 12 de junio de 2026 — Encuadre").
 */
export function contextToEvidence(context: RetrievedPatientContext): CaseEvidence {
  const input: CaseEvidenceInput = {
    notes: context.recentNotes.map((note) => ({
      title: note.title,
      date: spanishDate(note.createdAt),
      content: note.excerpt,
    })),
    diagnoses: context.diagnoses.map((diagnosis) => ({
      code: diagnosis.code,
      title: diagnosis.title,
      status: diagnosis.status,
    })),
    records: context.clinicalRecords.map((record) => ({
      title: record.title,
      date: spanishDate(record.updatedAt),
    })),
    upcomingAppointments: context.upcomingBookings.map((booking) => ({
      date: spanishDate(booking.startAt),
    })),
  };
  return buildCaseEvidence(input);
}

/**
 * Renderiza la sección "Fuentes" para pegar al final de la respuesta del
 * asistente: una lista numerada y citable ([1], [2]…) en el MISMO orden que
 * usa `formatSourcesForPrompt`, de modo que las marcas [n] coincidan tanto en
 * el modo con-API como en el local.
 */
export function renderSourcesSection(evidence: CaseEvidence): string {
  if (evidence.sources.length === 0) return '';
  const lines = evidence.sources.map((source, index) => `[${index + 1}] ${source.label}`);
  return `**${SOURCES_HEADING}**\n${lines.join('\n')}`;
}

/** Renderiza la sección de huecos; vacío si no hay huecos. */
export function renderGapsSection(evidence: CaseEvidence): string {
  const gaps = formatGaps(evidence);
  if (gaps === '') return '';
  return `**${GAPS_HEADING}**\n${gaps}`;
}

/** Forma parseada de un mensaje del asistente para pintarlo en la UI. */
export interface ParsedAssistantMessage {
  /** Cuerpo de la respuesta (prosa con marcas [n]); sin las secciones de abajo. */
  body: string;
  /** Etiquetas de las fuentes, ya sin el "[n] " inicial (el índice es la posición). */
  sources: string[];
  /** Huecos del caso (sin el guion inicial). */
  gaps: string[];
}

const SOURCE_LINE = /^\[\d+\]\s+(.*)$/;
const GAP_LINE = /^-\s+(.*)$/;

/**
 * Separa el cuerpo de la respuesta de las secciones "Fuentes" y "Lo que no
 * consta…" para que la UI las pinte como referencias y como aviso sutil. El
 * formato lo emiten los motores con `renderSourcesSection`/`renderGapsSection`,
 * así que el parseo es determinista y NO depende del proveedor.
 */
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const lines = content.split('\n');
  const bodyLines: string[] = [];
  const sources: string[] = [];
  const gaps: string[] = [];
  let section: 'body' | 'sources' | 'gaps' = 'body';

  for (const line of lines) {
    const heading = line.replace(/\*\*/g, '').trim();
    if (heading === SOURCES_HEADING) {
      section = 'sources';
      continue;
    }
    if (heading === GAPS_HEADING) {
      section = 'gaps';
      continue;
    }

    if (section === 'sources') {
      const match = SOURCE_LINE.exec(line.trim());
      if (match) {
        sources.push(match[1]);
        continue;
      }
      if (line.trim() === '') continue;
    }
    if (section === 'gaps') {
      const match = GAP_LINE.exec(line.trim());
      if (match) {
        gaps.push(match[1]);
        continue;
      }
      if (line.trim() === '') continue;
    }
    if (section === 'body') bodyLines.push(line);
  }

  return { body: bodyLines.join('\n').trim(), sources, gaps };
}
