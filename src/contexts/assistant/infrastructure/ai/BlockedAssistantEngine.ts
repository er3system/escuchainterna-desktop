import type { AssistantEngine } from '../../domain/AssistantEngine';
import { classifyScope, type ScopeVerdict } from '../../domain/scopeClassifier';

/**
 * Motor "bloqueado por presupuesto": cuando el plan alcanzó su tope mensual de
 * IA, el chat responde SIEMPRE con el mensaje amable de límite, como respuesta
 * del asistente dentro del hilo. No toca ningún motor real ni registra uso
 * (no se consumió IA). El flujo (hilos, persistencia, anclaje) sigue intacto y
 * la función vuelve sola el mes siguiente.
 */
export class BlockedAssistantEngine implements AssistantEngine {
  public constructor(private readonly blockedMessage: string) {}

  public providerName(): 'local' {
    return 'local';
  }

  public classifyScope(question: string): ScopeVerdict {
    return classifyScope(question);
  }

  public async answer(): Promise<string> {
    return this.blockedMessage;
  }

  /** Streaming: emite el mensaje de límite de una sola vez (no hay IA que streamear). */
  public async *answerStream(): AsyncGenerator<string> {
    yield this.blockedMessage;
  }
}
