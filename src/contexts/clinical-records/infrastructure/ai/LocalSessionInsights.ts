import {
  PatientReportData,
  RecordSnapshot,
  RecordUpdateProposal,
  SessionInsights,
  SessionReport,
  SupervisionCaseData,
} from '../../domain/SessionInsights';
import { buildCaseEvidence } from '@/shared/domain/clinicalEvidence';

/**
 * Vocabulario de técnicas/intervenciones frecuentes en notas clínicas en
 * español: el modo local solo REPORTA menciones literales, nunca infiere.
 */
const TECHNIQUE_KEYWORDS = [
  'psicoeducación',
  'reestructuración cognitiva',
  'registro de pensamientos',
  'autorregistro',
  'activación conductual',
  'exposición',
  'desensibilización',
  'mindfulness',
  'atención plena',
  'relajación',
  'respiración',
  'role playing',
  'juego de roles',
  'silla vacía',
  'entrevista motivacional',
  'línea de vida',
  'genograma',
  'economía de fichas',
  'higiene del sueño',
  'prevención de recaídas',
  'resolución de problemas',
  'habilidades sociales',
  'emdr',
  'tarea',
  'técnica',
  'intervención',
  'ejercicio',
];

/**
 * Adaptador local sin red: extrae frases clave de las notas con heurísticas
 * sencillas. Es el modo por defecto cuando no hay ANTHROPIC_API_KEY.
 *
 * Redacción (v3 §13): clínica, cálida y personalizada — saluda al profesional
 * por su nombre de pila cuando lo conoce, clara y accionable.
 */
export class LocalSessionInsights implements SessionInsights {
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

  public async answerQuestion(notes: string, question: string): Promise<string> {
    const sentences = this.splitSentences(notes);
    if (sentences.length === 0) {
      return `${this.greeting()} Las notas de esta sesión están vacías; cuando escribas algunas podré ayudarte a analizarlas.`;
    }
    const keywords = this.keywords(question);
    const relevant = sentences
      .map((sentence) => ({
        sentence,
        score: keywords.filter((keyword) => sentence.toLowerCase().includes(keyword)).length,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.sentence);

    if (relevant.length === 0) {
      return `${this.greeting()} Eso no consta en las notas de esta sesión: no encontré pasajes que respondan tu pregunta, así que no puedo afirmarlo sin inventar. Fragmento inicial de las notas, por contexto: "${sentences[0]}". (Modo local: conecta una clave de Anthropic en Configuración → Integraciones para respuestas más profundas.)`;
    }
    return `${this.greeting()} Según tus notas, los pasajes que respaldan la respuesta son (citados literalmente):\n\n${relevant
      .map((sentence) => `• «${sentence}»`)
      .join('\n')}\n\nSolo puedo afirmar lo que aparece en estos pasajes; si necesitas algo que no esté arriba, no consta en las notas. Si te sirve, puedo ayudarte a convertirlos en un reporte de sesión. (Modo local: conecta una clave de Anthropic en Configuración → Integraciones para análisis con IA.)`;
  }

  public async generateSessionReport(notes: string): Promise<SessionReport> {
    const sentences = this.splitSentences(notes);
    const principales = sentences.slice(0, 4);

    // Técnicas/intervenciones: SOLO las mencionadas literalmente en la nota; el
    // modo local nunca infiere intervenciones que no estén escritas.
    const intervencionesMencionadas = sentences.filter((sentence) => {
      const lowered = sentence.toLowerCase();
      return TECHNIQUE_KEYWORDS.some((keyword) => lowered.includes(keyword));
    });
    const intervencionesSugeridas =
      intervencionesMencionadas.length > 0
        ? intervencionesMencionadas.slice(0, 4).map((sentence) => `Según la nota: «${sentence}»`)
        : [
            'No consta en la nota ninguna intervención o técnica con nombre explícito; el modo local no infiere intervenciones que no estén escritas.',
          ];

    return {
      resumen:
        sentences.length > 0
          ? `La sesión registra ${sentences.length} apuntes (resumen basado solo en lo escrito en la nota). Tema inicial: ${sentences[0]}`
          : 'Sin notas registradas para esta sesión.',
      ideasPrincipales: principales.length > 0 ? principales : ['Sin contenido en las notas.'],
      intervencionesSugeridas,
      preguntasSiguienteSesion: [
        '¿Cómo evolucionó lo trabajado desde la última sesión?',
        '¿Qué situaciones nuevas surgieron desde entonces?',
      ],
    };
  }

  public async suggestRecordUpdates(notes: string, record: RecordSnapshot): Promise<RecordUpdateProposal[]> {
    const sentences = this.splitSentences(notes);
    if (sentences.length === 0) return [];
    const proposals: RecordUpdateProposal[] = [];
    const noteSummary = sentences.slice(0, 3).join(' ');

    for (const field of record.fields) {
      if (proposals.length >= 4) break;
      if (field.type !== 'texto_largo') continue;

      const labelKeywords = this.keywords(field.label);
      const matching = sentences.filter((sentence) =>
        labelKeywords.some((keyword) => sentence.toLowerCase().includes(keyword)),
      );
      const isNotesField = /notas adicionales|otros|evoluci/i.test(field.label);

      if (matching.length > 0 && !field.currentValue.includes(matching[0])) {
        proposals.push({
          fieldId: field.fieldId,
          sectionId: field.sectionId,
          label: field.label,
          currentValue: field.currentValue,
          suggestedValue: field.currentValue
            ? `${field.currentValue}\n\n[${record.templateName}] ${matching.slice(0, 2).join(' ')}`
            : matching.slice(0, 2).join(' '),
          reason: `La nota de sesión menciona contenido relacionado con "${field.label}" (modo local: revisa y ajusta la redacción).`,
        });
      } else if (isNotesField && !field.currentValue.includes(noteSummary)) {
        proposals.push({
          fieldId: field.fieldId,
          sectionId: field.sectionId,
          label: field.label,
          currentValue: field.currentValue,
          suggestedValue: field.currentValue ? `${field.currentValue}\n\n${noteSummary}` : noteSummary,
          reason: 'Resumen de la última nota de sesión para el registro acumulativo (modo local).',
        });
      }
    }
    return proposals;
  }

  public async draftPatientReport(
    kind: string,
    patientData: PatientReportData,
    countryGuidelines: string,
  ): Promise<string> {
    const periodo =
      patientData.firstNoteAt && patientData.lastNoteAt
        ? `del ${patientData.firstNoteAt} al ${patientData.lastNoteAt}`
        : 'periodo no registrado';
    const diagnosticos =
      patientData.diagnoses.length > 0
        ? patientData.diagnoses.map((d) => `- ${d.code} — ${d.title} (${d.status})`).join('\n')
        : '- Sin diagnósticos registrados en la plataforma.';

    // Los "huecos" del expediente ya NO van dentro del borrador firmable: se
    // muestran como checklist "Antes de firmar" en la UI de Exportar.
    return [
      `# ${this.reportTitle(kind)}`,
      '',
      `**Profesional:** ${patientData.professionalName}${patientData.professionalLicense ? ` · Cédula/Tarjeta profesional: ${patientData.professionalLicense}` : ''}`,
      `**Paciente:** ${patientData.patientName}${patientData.birthDate ? ` · Fecha de nacimiento: ${patientData.birthDate}` : ''}${patientData.gender ? ` · ${patientData.gender}` : ''}`,
      '',
      '## Motivo de consulta',
      patientData.consultationReason || 'No registrado.',
      '',
      '## Diagnósticos registrados (CIE-11)',
      diagnosticos,
      '',
      '## Proceso de atención',
      `Se registran ${patientData.sessionNotesCount} notas de sesión (${periodo})${patientData.therapyStartDate ? `, con inicio de proceso el ${patientData.therapyStartDate}` : ''}.`,
      '',
      '## Consideraciones normativas aplicables',
      countryGuidelines || 'Verifica la normativa vigente de tu país antes de emitir este documento.',
      '',
      '## Conclusión',
      '[Redacta aquí tu valoración profesional. Este borrador fue generado en modo local a partir de los datos registrados; revísalo y complétalo antes de firmar.]',
    ].join('\n');
  }

  public async polishNote(notes: string): Promise<string> {
    // El modo local no infiere ni reescribe: solo asea el formato del texto ya
    // escrito (espacios, mayúscula inicial, puntuación final por oración).
    const sentences = this.splitSentences(notes);
    if (sentences.length === 0) return notes;
    return sentences
      .map((sentence) => {
        const capped = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        return /[.!?…]$/.test(capped) ? capped : `${capped}.`;
      })
      .join(' ');
  }

  public async summarizeCaseForSupervision(caseData: SupervisionCaseData): Promise<string> {
    const notes = [...caseData.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Evidencia citable + huecos (idea adoptada de gbrain, sin su stack). El
    // orden de `sources` es: diagnósticos, historias, notas. Construimos índices
    // para citar [n] cada afirmación en su fuente exacta. No pasamos próximas
    // citas: el alcance de supervisión no las incluye, así que ese hueco no
    // aplica y se omite para no inducir a error.
    const evidence = buildCaseEvidence({
      notes: notes.map((note) => ({
        title: note.title,
        date: this.shortDate(note.createdAt),
        content: note.content,
      })),
      diagnoses: caseData.diagnoses,
      records: caseData.records.map((record) => ({
        title: record.title,
        date: this.shortDate(record.updatedAt),
      })),
      upcomingAppointments: [{ date: 'n/a' }],
    });
    // Quitamos el hueco de próximas citas (no aplica a supervisión).
    const gaps = evidence.gaps.filter((gap) => !gap.includes('próximas citas'));

    const diagnosisCitation = (index: number): string => `[${index + 1}]`;
    const recordCitation = (index: number): string =>
      `[${caseData.diagnoses.length + index + 1}]`;
    const noteCitation = (index: number): string =>
      `[${caseData.diagnoses.length + caseData.records.length + index + 1}]`;

    const lines: string[] = [];

    lines.push(`# Resumen del caso — ${caseData.patientName}`);
    lines.push('');
    lines.push(`**Profesional supervisado:** ${caseData.supervisedName}`);
    if (caseData.consultationReason) lines.push(`**Motivo de consulta:** ${caseData.consultationReason}`);
    if (caseData.therapyStartDate) lines.push(`**Inicio del proceso:** ${this.shortDate(caseData.therapyStartDate)}`);
    lines.push('');

    // ---- Qué se ha trabajado (cada nota citada en su fuente [n]) ----
    lines.push('## Qué se ha trabajado');
    if (notes.length === 0) {
      lines.push('No hay notas de sesión accesibles con tu alcance de supervisión, o el caso aún no tiene registros.');
    } else {
      notes.forEach((note, index) => {
        const sentences = this.splitSentences(note.content);
        const gist = sentences.slice(0, 2).join(' ') || 'Sin contenido registrado.';
        lines.push(`- **${this.shortDate(note.createdAt)} · ${note.title}:** ${gist} ${noteCitation(index)}`);
      });
    }
    lines.push('');

    // ---- Técnicas e intervenciones (solo menciones literales, citadas) ----
    lines.push('## Técnicas e intervenciones registradas');
    const techniqueLines: string[] = [];
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      for (const sentence of this.splitSentences(note.content)) {
        const lowered = sentence.toLowerCase();
        if (TECHNIQUE_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
          techniqueLines.push(`- (${this.shortDate(note.createdAt)}) ${sentence} ${noteCitation(index)}`);
          if (techniqueLines.length >= 6) break;
        }
      }
      if (techniqueLines.length >= 6) break;
    }
    if (techniqueLines.length > 0) {
      lines.push(...techniqueLines);
    } else {
      lines.push('Las notas no mencionan técnicas o intervenciones con nombre explícito (el modo local solo detecta menciones literales; revisa las notas completas).');
    }
    lines.push('');

    // ---- Evolución temporal ----
    lines.push('## Evolución temporal');
    if (notes.length === 0) {
      lines.push('Sin notas registradas: no es posible describir la evolución.');
    } else {
      const first = notes[0];
      const last = notes[notes.length - 1];
      lines.push(
        `Se registran ${notes.length} ${notes.length === 1 ? 'nota de sesión' : 'notas de sesión'} entre el ${this.shortDate(first.createdAt)} y el ${this.shortDate(last.createdAt)}.`,
      );
      if (notes.length > 1) {
        const lastGist = this.splitSentences(last.content).slice(0, 2).join(' ');
        if (lastGist) {
          lines.push(`Registro más reciente (${this.shortDate(last.createdAt)}): ${lastGist} ${noteCitation(notes.length - 1)}`);
        }
      }
    }
    lines.push('');

    // ---- Historia clínica y diagnósticos (citados en su fuente [n]) ----
    lines.push('## Historia clínica y diagnósticos');
    if (caseData.records.length === 0) {
      lines.push('- Sin historias clínicas accesibles o registradas.');
    } else {
      caseData.records.forEach((record, index) => {
        lines.push(
          `- Historia "${record.title}" (plantilla: ${record.templateName}), actualizada el ${this.shortDate(record.updatedAt)}. ${recordCitation(index)}`,
        );
      });
    }
    if (caseData.diagnoses.length === 0) {
      lines.push('- Sin diagnósticos CIE-11 registrados.');
    } else {
      caseData.diagnoses.forEach((diagnosis, index) => {
        lines.push(`- Diagnóstico ${diagnosis.code} — ${diagnosis.title} (${diagnosis.status}). ${diagnosisCitation(index)}`);
      });
    }
    lines.push('');

    // ---- Fuentes citadas ----
    if (evidence.sources.length > 0) {
      lines.push('## Fuentes');
      evidence.sources.forEach((source, index) => {
        lines.push(`- [${index + 1}] ${source.label}`);
      });
      lines.push('');
    }

    // ---- Lo que no consta en el expediente (huecos explícitos) ----
    lines.push('## Lo que no consta en el expediente');
    if (gaps.length === 0) {
      lines.push('No se detectaron huecos en las secciones registradas del expediente accesible.');
    } else {
      for (const gap of gaps) lines.push(`- ${gap}`);
    }
    lines.push('');

    lines.push(
      '_Resumen generado en modo local a partir de los registros del expediente: cita las fuentes registradas y señala lo que no consta, pero no infiere ni sustituye la lectura de las notas. Conecta una clave de Anthropic en Configuración → Integraciones para un análisis clínico más profundo._',
    );

    return lines.join('\n');
  }

  private shortDate(iso: string): string {
    return iso.slice(0, 10);
  }

  private reportTitle(kind: string): string {
    switch (kind) {
      case 'legal':
        return 'Informe en respuesta a requerimiento legal';
      case 'constancia':
        return 'Constancia de atención psicológica';
      case 'riesgo':
        return 'Reporte de riesgo y derivación';
      default:
        return 'Informe clínico general';
    }
  }

  private splitSentences(text: string): string[] {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 3);
  }

  private keywords(question: string): string[] {
    const stopwords = new Set([
      'que', 'cual', 'cuales', 'como', 'cuando', 'donde', 'quien', 'por', 'para', 'con', 'sin',
      'las', 'los', 'una', 'uno', 'del', 'sobre', 'entre', 'este', 'esta', 'fue', 'son', 'tiene',
    ]);
    return question
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/\W+/)
      .filter((word) => word.length > 2 && !stopwords.has(word));
  }
}
