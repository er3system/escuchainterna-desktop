import type { ScopeVerdict } from './scopeClassifier';
import type { RetrievedPatientContext } from './PatientContextRetriever';

/**
 * Puerto del motor del asistente de IA.
 *
 * Implementaciones: LocalAssistantEngine (sin red, por defecto) y
 * AnthropicAssistantEngine (si hay ANTHROPIC_API_KEY). Ambas quedan SIEMPRE
 * detrás del mismo clasificador de alcance y del mismo PatientContextRetriever
 * acotado por owner_user_id: el motor nunca consulta datos por su cuenta y el
 * contexto recuperado se trata como DATOS, nunca como instrucciones.
 */
export interface AssistantEngine {
  /** Clasificador de alcance (heurística local; se ejecuta antes de responder). */
  classifyScope(question: string): ScopeVerdict;

  /** Responde una pregunta YA clasificada como permitida, con el contexto recuperado. */
  answer(question: string, retrievedContext: RetrievedPatientContext | null): Promise<string>;

  /**
   * Igual que answer() pero en STREAMING: emite fragmentos de texto a medida que
   * llegan. La CONCATENACIÓN de todos los fragmentos es el texto final
   * autoritativo (incluye las secciones de Fuentes/huecos), idéntico en
   * contenido a answer(). El motor local/bloqueado emite su texto de una sola
   * vez; el remoto emite los deltas del modelo y luego el bloque de evidencia.
   */
  answerStream(question: string, retrievedContext: RetrievedPatientContext | null): AsyncIterable<string>;

  providerName(): 'local' | 'anthropic' | 'openai';

  /**
   * Uso REAL (tokens facturables equivalentes, ya ajustados por caché) de la
   * ÚLTIMA llamada a answer(). Opcional: solo el adaptador remoto lo expone; el
   * medidor lo prefiere sobre su estimación por longitud. La fábrica crea una
   * instancia por petición, así que siempre refleja la llamada recién resuelta.
   */
  lastUsage?(): { inputTokens: number; outputTokens: number } | null;

  /**
   * Modelo REAL elegido por el ruteo por intención en la ÚLTIMA llamada a
   * answer(). Opcional: solo el adaptador remoto, que ejecuta una llamada real,
   * lo expone; el medidor lo prefiere para registrar el modelo verdaderamente
   * usado (y su costo). Devuelve null antes de la primera respuesta.
   */
  lastModel?(): string | null;
}
