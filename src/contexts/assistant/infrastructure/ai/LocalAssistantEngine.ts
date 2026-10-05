import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { RetrievedPatientContext } from '../../domain/PatientContextRetriever';
import { classifyScope, ScopeVerdict } from '../../domain/scopeClassifier';
import {
  contextToEvidence,
  renderGapsSection,
  renderSourcesSection,
} from '../../domain/caseEvidence';
import type { CaseEvidence } from '@/shared/domain/clinicalEvidence';

export const LOCAL_MODE_NOTE =
  'Modo local: organiza la información registrada. La IA remota requiere un proveedor configurado y conexión a internet.';

function formatDate(iso: string | null): string {
  if (!iso) return 'sin registrar';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'sin registrar';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "EEEE d 'de' MMMM 'de' yyyy, HH:mm 'h'", { locale: es });
}

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '');
}

/**
 * Motor local del asistente (sin red): responde con extractos organizados del
 * contexto que YA recuperó el PatientContextRetriever acotado por owner.
 * El contenido clínico se trata como datos — aquí solo se formatea, jamás se
 * interpreta como instrucciones.
 *
 * Tono (v3 §13): clínico, cálido y personalizado — saluda al profesional por
 * su nombre de pila cuando lo conoce y usa el nombre del paciente con
 * naturalidad.
 */
export class LocalAssistantEngine implements AssistantEngine {
  private readonly professionalFirstName: string;

  public constructor(professionalName = '') {
    this.professionalFirstName = professionalName.trim().split(/\s+/)[0] ?? '';
  }

  private greeting(): string {
    return this.professionalFirstName ? `Hola, ${this.professionalFirstName}.` : 'Hola.';
  }

  public providerName(): 'local' {
    return 'local';
  }

  public classifyScope(question: string): ScopeVerdict {
    return classifyScope(question);
  }

  public async answer(question: string, retrievedContext: RetrievedPatientContext | null): Promise<string> {
    if (retrievedContext === null) {
      return [
        `${this.greeting()} No identifiqué a cuál de tus pacientes te refieres. Menciona su nombre tal como lo registraste ` +
          '(por ejemplo: "¿Qué notas recientes tengo de Ana López?") o ancla un paciente al hilo con el selector "Hablar sobre".',
        'También puedo orientarte sobre el uso de la plataforma: agenda, pacientes, pagos, mensajes, marketing y biblioteca desde el menú lateral.',
        `_${LOCAL_MODE_NOTE}_`,
      ].join('\n\n');
    }

    const q = normalize(question);
    const wantsBookings = /\b(cita|citas|agenda|proxima|proximas|cuando|horario)\b/.test(q);
    const wantsNotes = /\b(nota|notas|sesion|sesiones|evolucion|seguimiento|avance|resumen)\b/.test(q);
    const wantsDiagnoses = /\b(diagnostico|diagnosticos|cie)\b/.test(q);
    const wantsRecords = /\b(historia|historias|expediente|formulario)\b/.test(q);
    const askedSomethingSpecific = wantsBookings || wantsNotes || wantsDiagnoses || wantsRecords;

    const { patient, diagnoses, recentNotes, clinicalRecords, upcomingBookings } = retrievedContext;

    // Evidencia citable + huecos (módulo PURO compartido). El orden de las
    // fuentes lo fija buildCaseEvidence: diagnósticos, historias y luego notas;
    // calculamos el índice [n] de cada fuente para citar en el cuerpo.
    const evidence = contextToEvidence(retrievedContext);
    const cite = this.citationIndexer(evidence);

    const sections: string[] = [];

    sections.push(
      `${this.greeting()} Esto es lo que tengo registrado sobre ${patient.fullName}. Cada dato cita su fuente:`,
    );

    const headerLines = [`**${patient.fullName}**`];
    if (patient.gender) headerLines.push(`- Género: ${patient.gender}`);
    if (patient.birthDate) headerLines.push(`- Fecha de nacimiento: ${formatDate(patient.birthDate)}`);
    if (patient.consultationReason) headerLines.push(`- Motivo de consulta: ${patient.consultationReason}`);
    if (patient.therapyStartDate) headerLines.push(`- Inicio de terapia: ${formatDate(patient.therapyStartDate)}`);
    if (patient.tags.length > 0) headerLines.push(`- Etiquetas: ${patient.tags.join(', ')}`);
    sections.push(headerLines.join('\n'));

    if (!askedSomethingSpecific || wantsDiagnoses) {
      sections.push(
        diagnoses.length > 0
          ? `**Diagnósticos (CIE-11)**\n${diagnoses
              .map(
                (d) =>
                  `- ${d.code} — ${d.title} (${d.status}, ${formatDate(d.diagnosedAt)})${cite('diagnostico', d.code)}`,
              )
              .join('\n')}`
          : '**Diagnósticos (CIE-11)**\n- Sin diagnósticos registrados.',
      );
    }

    if (!askedSomethingSpecific || wantsNotes) {
      sections.push(
        recentNotes.length > 0
          ? `**Notas de sesión recientes**\n${recentNotes
              .map((n) => `- ${formatDate(n.createdAt)} · *${n.title}*: ${n.excerpt}${cite('nota', n.title)}`)
              .join('\n')}`
          : '**Notas de sesión recientes**\n- Sin notas de sesión registradas.',
      );
    }

    if (!askedSomethingSpecific || wantsRecords) {
      sections.push(
        clinicalRecords.length > 0
          ? `**Historias clínicas**\n${clinicalRecords
              .map((r) => `- ${r.title} (actualizada el ${formatDate(r.updatedAt)})${cite('historia', r.title)}`)
              .join('\n')}`
          : '**Historias clínicas**\n- Sin historias clínicas registradas.',
      );
    }

    if (!askedSomethingSpecific || wantsBookings) {
      // Las próximas citas no son una fuente citable (solo generan un hueco si
      // faltan): se listan como dato de agenda, sin marca [n].
      sections.push(
        upcomingBookings.length > 0
          ? `**Próximas citas**\n${upcomingBookings
              .map((b) => `- ${formatDateTime(b.startAt)} · ${b.agendaName} (${b.status})`)
              .join('\n')}`
          : '**Próximas citas**\n- Sin citas próximas agendadas.',
      );
    }

    // Secciones de evidencia: fuentes numeradas + huecos explícitos.
    const sourcesSection = renderSourcesSection(evidence);
    if (sourcesSection !== '') sections.push(sourcesSection);
    const gapsSection = renderGapsSection(evidence);
    if (gapsSection !== '') sections.push(gapsSection);

    sections.push(`_${LOCAL_MODE_NOTE}_`);
    return sections.join('\n\n');
  }

  /**
   * Streaming: el motor local no consulta red, así que no hay deltas reales —
   * emite el texto completo de una sola vez. Mantiene uniforme el camino de
   * streaming del caso de uso (mismo contrato que el motor remoto).
   */
  public async *answerStream(
    question: string,
    retrievedContext: RetrievedPatientContext | null,
  ): AsyncGenerator<string> {
    yield await this.answer(question, retrievedContext);
  }

  /**
   * Devuelve una función que, dado el tipo y un identificador de fuente,
   * produce la marca de cita " [n]" si esa fuente existe en la evidencia. El
   * índice coincide con `renderSourcesSection` / `formatSourcesForPrompt`.
   */
  private citationIndexer(evidence: CaseEvidence): (kind: CaseEvidence['sources'][number]['kind'], key: string) => string {
    const normalizedKey = (text: string) => normalize(text);
    return (kind, key) => {
      const target = normalizedKey(key);
      const index = evidence.sources.findIndex(
        (source) => source.kind === kind && normalizedKey(source.label).includes(target),
      );
      return index === -1 ? '' : ` [${index + 1}]`;
    };
  }
}
