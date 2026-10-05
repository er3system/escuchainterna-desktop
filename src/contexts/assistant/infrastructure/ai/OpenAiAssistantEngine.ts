import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { RetrievedPatientContext } from '../../domain/PatientContextRetriever';
import { classifyScope, type ScopeVerdict } from '../../domain/scopeClassifier';
import { contextToEvidence, renderGapsSection, renderSourcesSection } from '../../domain/caseEvidence';
import { formatSourcesForPrompt } from '@/shared/domain/clinicalEvidence';
import { buildSystemPrompt } from './AnthropicAssistantEngine';

/** Adaptador Responses: mismo alcance y evidencia que los otros motores, sin almacenamiento remoto solicitado. */
export class OpenAiAssistantEngine implements AssistantEngine {
  private usage: { inputTokens: number; outputTokens: number } | null = null;
  public constructor(private readonly apiKey: string, private readonly model: string, private readonly professionalName = '') {}
  public providerName(): 'openai' { return 'openai'; }
  public classifyScope(question: string): ScopeVerdict { return classifyScope(question); }
  public lastUsage(): { inputTokens: number; outputTokens: number } | null { return this.usage; }
  public lastModel(): string { return this.model; }
  public async answer(question: string, context: RetrievedPatientContext | null): Promise<string> {
    this.usage = null;
    const evidence = context === null ? null : contextToEvidence(context);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(90_000), redirect: 'error',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, store: false, max_output_tokens: 4096,
        instructions: buildSystemPrompt(this.professionalName),
        input: `<contexto_clinico>\n${JSON.stringify(context)}\n</contexto_clinico>\n<fuentes>\n${evidence ? formatSourcesForPrompt(evidence) : ''}\n</fuentes>\n<huecos>\n${evidence?.gaps.join('\n') ?? ''}\n</huecos>\nPregunta del profesional: ${question}` }),
    });
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status}. Revisa tu clave, saldo y modelo en Servicios opcionales.`);
    const data = await response.json() as { status?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[]; usage?: { input_tokens: number; output_tokens: number } };
    if (data.usage) this.usage = { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens };
    if (data.status && data.status !== 'completed') throw new Error('OpenAI no completó la respuesta. Prueba una pregunta más breve o cambia el modelo.');
    const answer = (data.output ?? []).filter(item => item.type === 'message').flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('\n');
    if (!answer.trim()) throw new Error('OpenAI no devolvió texto. Comprueba que el modelo admita Responses.');
    return [answer, ...(evidence ? [renderSourcesSection(evidence), renderGapsSection(evidence)] : [])].filter(Boolean).join('\n\n');
  }
  public async *answerStream(question: string, context: RetrievedPatientContext | null): AsyncGenerator<string> {
    yield await this.answer(question, context);
  }
}
