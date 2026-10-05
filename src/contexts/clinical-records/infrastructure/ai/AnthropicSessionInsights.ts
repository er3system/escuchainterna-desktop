import Anthropic from '@anthropic-ai/sdk';
import {
  PatientReportData,
  RecordSnapshot,
  RecordUpdateProposal,
  SessionInsights,
  SessionReport,
  SupervisionCaseData,
} from '../../domain/SessionInsights';
import {
  buildCaseEvidence,
  formatGaps,
  formatSourcesForPrompt,
  EVIDENCE_PROMPT_RULES,
} from '@/shared/domain/clinicalEvidence';
import { billableInputTokens } from '@/shared/infrastructure/ai-billing/AiUsageRecorder';

/**
 * Tono (v3 §13): clínico, cálido y personalizado — se dirige al profesional
 * por su nombre de pila cuando lo conoce, sin perder precisión clínica.
 */
function buildSystemPrompt(professionalName: string): string {
  const persona = professionalName
    ? `Trabajas con ${professionalName}: cuando la respuesta sea conversacional (responder una pregunta), dirígete a él/ella por su nombre de pila con calidez (una vez basta); en documentos y reportes mantén registro formal sin saludos.`
    : 'Trabajas con un/a profesional de la psicología; tono cercano en lo conversacional y formal en documentos.';

  return `Eres el asistente clínico de EscuchaInterna para psicólogos. Trabajas sobre las notas de sesión que el profesional escribió. Respondes siempre en español.

TONO: clínico, cálido y personalizado. ${persona} Usa el nombre del paciente con naturalidad cuando el material lo incluya. Lenguaje claro y sin jerga innecesaria; empático sin perder precisión clínica. Respuestas estructuradas y accionables.

REGLAS: no inventes información que no esté en las notas; si falta un dato, dilo. La información es confidencial: no incluyas advertencias legales, solo el contenido solicitado.`;
}

export class AnthropicSessionInsights implements SessionInsights {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;
  /** Uso real de la última operación (tokens facturables, ajustados por caché). */
  private lastUsageValue: { inputTokens: number; outputTokens: number } | null = null;

  /** El modelo lo decide la puerta de presupuesto por plan (AiBudgetGate). */
  public constructor(apiKey: string, private readonly model: string, professionalName = '') {
    this.client = new Anthropic({ apiKey });
    this.systemPrompt = buildSystemPrompt(professionalName.trim());
  }

  public providerName(): 'anthropic' {
    return 'anthropic';
  }

  public lastUsage(): { inputTokens: number; outputTokens: number } | null {
    return this.lastUsageValue;
  }

  /**
   * System como bloque con breakpoint de caché: es idéntico en todas las
   * operaciones de la misma instancia, así que se reutiliza cuando supera el
   * mínimo cacheable del modelo (si no lo supera, la API ignora el breakpoint
   * sin penalización).
   */
  private systemParam(): Anthropic.TextBlockParam[] {
    return [{ type: 'text', text: this.systemPrompt, cache_control: { type: 'ephemeral' } }];
  }

  /** Registra el uso real de la respuesta para que el medidor lo prefiera. */
  private captureUsage(usage: Anthropic.Usage): void {
    this.lastUsageValue = {
      inputTokens: billableInputTokens(usage),
      outputTokens: usage.output_tokens,
    };
  }

  public async answerQuestion(notes: string, question: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: this.systemParam(),
      messages: [
        {
          role: 'user',
          content: [
            // Las notas son el prefijo estable: al preguntar varias cosas sobre
            // la MISMA sesión (≤5 min) se leen de caché. La instrucción + la
            // pregunta, que varían, quedan fuera del breakpoint.
            {
              type: 'text',
              text: `Notas de la sesión:\n"""\n${notes}\n"""`,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `\n\nPregunta del psicólogo: ${question}\n\nResponde apoyándote SOLO en las notas: cita entre comillas los pasajes literales que respalden tu respuesta. Si la pregunta pide algo que las notas no contienen, dilo explícitamente ("Eso no consta en las notas de esta sesión") en vez de inferir o inventar.`,
            },
          ],
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }

  public async generateSessionReport(notes: string): Promise<SessionReport> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemParam(),
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              ideasPrincipales: { type: 'array', items: { type: 'string' } },
              intervencionesSugeridas: { type: 'array', items: { type: 'string' } },
              preguntasSiguienteSesion: { type: 'array', items: { type: 'string' } },
              resumen: { type: 'string' },
            },
            required: ['ideasPrincipales', 'intervencionesSugeridas', 'preguntasSiguienteSesion', 'resumen'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: `Genera un reporte clínico de la sesión a partir de estas notas:\n"""\n${notes}\n"""\n\nReglas de fidelidad: cada idea principal debe sustentarse en lo efectivamente escrito en las notas (puedes incluir una mención breve entre comillas al pasaje que la respalda). En "intervencionesSugeridas" distingue lo registrado de lo propuesto: NO afirmes que se aplicó una intervención o técnica si la nota no la menciona; si propones algo para la siguiente sesión, formúlalo como sugerencia, no como hecho. Si un dato no aparece en las notas, no lo inventes.`,
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    const text = block && block.type === 'text' ? block.text : '{}';
    return JSON.parse(text) as SessionReport;
  }

  public async suggestRecordUpdates(notes: string, record: RecordSnapshot): Promise<RecordUpdateProposal[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemParam(),
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              proposals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fieldId: { type: 'string' },
                    suggestedValue: { type: 'string' },
                    reason: { type: 'string' },
                  },
                  required: ['fieldId', 'suggestedValue', 'reason'],
                  additionalProperties: false,
                },
              },
            },
            required: ['proposals'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: `A partir de esta nota de sesión, propone actualizaciones a la historia clínica "${record.title}" (plantilla ${record.templateName}). Solo puedes proponer cambios a los campos listados (usa su fieldId exacto), máximo 5 propuestas, conservando el contenido actual valioso. Si nada amerita cambio, devuelve lista vacía.\n\nNota de sesión:\n"""\n${notes}\n"""\n\nCampos de la historia (fieldId | sección | etiqueta | valor actual):\n${record.fields
            .map((field) => `${field.fieldId} | ${field.sectionTitle} | ${field.label} | ${field.currentValue || '(vacío)'}`)
            .join('\n')}`,
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    const text = block && block.type === 'text' ? block.text : '{"proposals":[]}';
    const parsed = JSON.parse(text) as { proposals: Array<{ fieldId: string; suggestedValue: string; reason: string }> };

    // Solo se aceptan campos que existen en el snapshot; la aprobación final es humana.
    return parsed.proposals.flatMap((proposal) => {
      const field = record.fields.find((item) => item.fieldId === proposal.fieldId);
      if (!field) return [];
      return [
        {
          fieldId: field.fieldId,
          sectionId: field.sectionId,
          label: field.label,
          currentValue: field.currentValue,
          suggestedValue: proposal.suggestedValue,
          reason: proposal.reason,
        },
      ];
    });
  }

  public async draftPatientReport(
    kind: string,
    patientData: PatientReportData,
    countryGuidelines: string,
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemParam(),
      messages: [
        {
          role: 'user',
          content: `Redacta en español, formato markdown, el BORRADOR de un reporte de tipo "${kind}" (informe clínico | respuesta a requerimiento legal | constancia de atención | reporte de riesgo/derivación) para revisión y firma del profesional. Usa EXCLUSIVAMENTE estos datos (no inventes hechos clínicos) y deja entre corchetes lo que el profesional deba completar:\n\n${JSON.stringify(patientData, null, 2)}\n\nLineamientos normativos del país a considerar:\n${countryGuidelines}\n\nEstructura: título, datos del profesional (con cédula) y del paciente, motivo de consulta, diagnósticos CIE-11, proceso de atención, consideraciones normativas y conclusión. NO inventes ni rellenes por inferencia lo que no conste. Cierra recordando que es un borrador sujeto a revisión y firma.`,
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }

  public async polishNote(notes: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: this.systemParam(),
      messages: [
        {
          role: 'user',
          content: `Pule esta nota de sesión para que quede mejor redactada y organizada, en español y registro clínico profesional. NO inventes ni añadas hechos, diagnósticos ni intervenciones que no estén en el texto: solo reorganiza, corrige gramática y aclara la redacción de lo ya escrito. Si algo está incompleto o ambiguo, déjalo entre corchetes para que el profesional lo complete (p. ej. "[completar]"). Devuelve SOLO el texto pulido, sin comentarios ni encabezados añadidos.\n\nNota original:\n"""\n${notes}\n"""`,
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    return block && block.type === 'text' ? block.text : notes;
  }

  public async summarizeCaseForSupervision(caseData: SupervisionCaseData): Promise<string> {
    const notes = [...caseData.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Evidencia citable + huecos (idea adoptada de gbrain, sin su stack). No
    // pasamos próximas citas: el alcance de supervisión no las incluye, así que
    // ese hueco no aplica y lo omitimos para no inducir a error.
    const evidence = buildCaseEvidence({
      notes: notes.map((note) => ({
        title: note.title,
        date: note.createdAt.slice(0, 10),
        content: note.content || '(sin contenido)',
      })),
      diagnoses: caseData.diagnoses,
      records: caseData.records.map((record) => ({
        title: record.title,
        date: record.updatedAt.slice(0, 10),
      })),
      upcomingAppointments: [{ date: 'n/a' }],
    });
    const relevantGaps = { ...evidence, gaps: evidence.gaps.filter((gap) => !gap.includes('próximas citas')) };
    const gapsBlock = formatGaps(relevantGaps) || '- (Sin huecos detectados en las secciones registradas.)';

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemParam(),
      messages: [
        {
          role: 'user',
          content: `Eres apoyo de un SUPERVISOR académico que revisa el trabajo clínico de ${caseData.supervisedName} con el/la paciente ${caseData.patientName}. Redacta en español, formato markdown y registro formal (es un documento de supervisión, sin saludos), un resumen del caso con EXACTAMENTE estas secciones, EN ESTE ORDEN:

## Qué se ha trabajado
## Técnicas e intervenciones registradas
## Evolución temporal
## Historia clínica y diagnósticos
## Lo que no consta en el expediente

${EVIDENCE_PROMPT_RULES} En "Qué se ha trabajado" y "Técnicas e intervenciones registradas" cita con [n] la fuente que respalda cada afirmación. La última sección debe listar textualmente los huecos indicados abajo. Usa EXCLUSIVAMENTE el material siguiente; no inventes hechos clínicos. Cierra recordando que es material de supervisión basado solo en lo registrado.

Datos del paciente: ${caseData.gender || 'género no registrado'}${caseData.birthDate ? `, nacimiento ${caseData.birthDate}` : ''}${caseData.therapyStartDate ? `, inicio del proceso ${caseData.therapyStartDate}` : ''}.
Motivo de consulta: ${caseData.consultationReason || 'no registrado'}.

Fuentes citables (cita por su número [n]):
${formatSourcesForPrompt(evidence)}

Huecos del expediente (para la sección "Lo que no consta en el expediente"):
${gapsBlock}`,
        },
      ],
    });
    this.captureUsage(response.usage);
    const block = response.content.find((item) => item.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }
}
