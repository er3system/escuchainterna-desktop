import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { PatientContextRetriever } from '../../domain/PatientContextRetriever';

/** Registra que la IA recuperó contexto del paciente para el briefing (habeas data). */
export type AuditAiAccess = (patientId: string) => Promise<void>;

/**
 * Instrucción del briefing pre-sesión. Respeta solo-preguntar: la IA SUGIERE y organiza lo
 * registrado, NO diagnostica ni decide; el psicólogo es quien decide. Cita fuentes y declara huecos
 * (el motor ya lo refuerza). Se entrega como un único "question" al motor del asistente.
 */
export const BRIEFING_PROMPT = `Prepárame un briefing BREVE para ANTES de la sesión con este paciente (60 segundos de lectura). Usa viñetas cortas, en este orden:
- En qué quedó el proceso (lo último relevante de las notas).
- Tareas o acuerdos pendientes de la última sesión, si los hay.
- Hipótesis o diagnóstico vigente.
- 2-3 líneas de exploración sugeridas para la sesión de hoy.
No diagnostiques ni decidas por mí: son sugerencias para que YO decida. Sé conciso y concreto. Cita la fuente de cada dato y declara lo que no consta en el expediente.`;

export interface SessionBriefingResult {
  /** false cuando no hay contexto: paciente sin consentimiento-IA, inexistente o en custodia. */
  available: boolean;
  /** Briefing en markdown (con sus secciones de Fuentes y huecos). Vacío si no disponible. */
  text: string;
}

/**
 * Briefing pre-sesión "Antes de ver a X": síntesis de 60 segundos para que el psicólogo entre a la
 * consulta con el contexto fresco. Reusa el MISMO retriever consent-gated y el MISMO motor (medido,
 * con citas/huecos) del asistente → hereda todos los guardrails: aislamiento por dueño, gate de
 * consentimiento-IA (si el paciente no autorizó, no hay briefing), medición y honestidad forzada.
 */
export class GenerateSessionBriefing {
  public constructor(
    private readonly retriever: PatientContextRetriever,
    private readonly engine: AssistantEngine,
    private readonly auditAiAccess: AuditAiAccess = async () => {},
  ) {}

  public async execute(patientId: string): Promise<SessionBriefingResult> {
    const context = await this.retriever.retrieve(patientId);
    if (context === null) return { available: false, text: '' };
    await this.auditAiAccess(patientId);
    const text = await this.engine.answer(BRIEFING_PROMPT, context);
    return { available: true, text };
  }
}
