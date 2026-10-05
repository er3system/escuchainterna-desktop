import { estimateTokens, recordUsage } from '@/shared/infrastructure/ai-billing/AiUsageRecorder';
import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { RetrievedPatientContext } from '../../domain/PatientContextRetriever';
import type { ScopeVerdict } from '../../domain/scopeClassifier';
import { routeIntent, resolveRoutedModel, type ModelCandidates } from '../../domain/intentRouter';

/**
 * Decorador de medición del chat: delega en el motor real (Anthropic o local)
 * y registra DESPUÉS cada respuesta en `ai_usage_events` (kind 'chat') con
 * tokens estimados (~4 caracteres por token sobre pregunta + contexto y
 * respuesta) y el modelo realmente usado por el ruteo por intención.
 *
 * El modelo registrado es, por orden de preferencia: (1) `lastModel()` del motor
 * remoto, que es la verdad de la llamada real; (2) en modo local —sin red— se
 * computa con el MISMO router puro sobre los mismos candidatos, de modo que la
 * medición refleja el modelo que SE HABRÍA usado (costo realista desde el primer
 * día). No altera guardrails ni retrieval.
 */
export class MeteredAssistantEngine implements AssistantEngine {
  public constructor(
    private readonly inner: AssistantEngine,
    private readonly ownerUserId: string,
    private readonly models: ModelCandidates,
  ) {}

  public providerName(): 'local' | 'anthropic' {
    return this.inner.providerName();
  }

  public classifyScope(question: string): ScopeVerdict {
    return this.inner.classifyScope(question);
  }

  public async answer(question: string, retrievedContext: RetrievedPatientContext | null): Promise<string> {
    const answer = await this.inner.answer(question, retrievedContext);
    // Uso real de la API (ajustado por caché) si el adaptador lo expone; si no
    // —modo local, sin red—, se estima por longitud. La fábrica crea una
    // instancia por petición, así que lastUsage() refleja esta llamada.
    const actual = this.inner.lastUsage?.();
    // Modelo realmente usado: el del motor remoto, o el del ruteo por intención
    // (mismo router puro) en modo local. Su tarifa decide el costo registrado.
    const model =
      this.inner.lastModel?.() ?? resolveRoutedModel(routeIntent(question, retrievedContext !== null), this.models);
    const promptText = `${question}\n${retrievedContext === null ? '' : JSON.stringify(retrievedContext)}`;
    await recordUsage({
      ownerUserId: this.ownerUserId,
      kind: 'chat',
      model,
      inputTokens: actual ? actual.inputTokens : estimateTokens(promptText),
      outputTokens: actual ? actual.outputTokens : estimateTokens(answer),
    });
    return answer;
  }

  /**
   * Streaming medido: reemite los deltas del motor interno y registra el uso en
   * `ai_usage_events` (uso real si el adaptador lo expone; si no, estimado por
   * longitud del texto acumulado). El modelo es el realmente usado por el ruteo
   * (lastModel del motor remoto, o el mismo router puro en modo local).
   *
   * La medición va en `finally` A PROPÓSITO: si el consumidor aborta el stream
   * (cliente que cierra la pestaña a mitad de respuesta), el `for await` de
   * arriba termina vía return() y sin el finally NO se registraría nada — tokens
   * reales de Anthropic sin fila en ai_usage_events, es decir, un bypass del
   * tope de presupuesto repetible a voluntad. Si el motor LANZA antes de emitir
   * nada, no se registra (mismo contrato que answer(), que tampoco registra al
   * fallar); si lanza a mitad, lo emitido sí se mide (consumo real).
   */
  public async *answerStream(
    question: string,
    retrievedContext: RetrievedPatientContext | null,
  ): AsyncGenerator<string> {
    let full = '';
    try {
      for await (const delta of this.inner.answerStream(question, retrievedContext)) {
        full += delta;
        yield delta;
      }
    } finally {
      const actual = this.inner.lastUsage?.();
      if (full.length > 0 || actual !== null) {
        const model =
          this.inner.lastModel?.() ??
          resolveRoutedModel(routeIntent(question, retrievedContext !== null), this.models);
        const promptText = `${question}\n${retrievedContext === null ? '' : JSON.stringify(retrievedContext)}`;
        await recordUsage({
          ownerUserId: this.ownerUserId,
          kind: 'chat',
          model,
          inputTokens: actual ? actual.inputTokens : estimateTokens(promptText),
          outputTokens: actual ? actual.outputTokens : estimateTokens(full),
        });
      }
    }
  }
}
