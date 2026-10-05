import { randomUUID } from 'node:crypto';
import { ChatThread } from '../../domain/ChatThread';
import { ChatMessage } from '../../domain/ChatMessage';
import { ChatThreadNotFoundError } from '../../domain/errors/ChatThreadNotFoundError';
import { PatientNotInOwnerScopeError } from '../../domain/errors/PatientNotInOwnerScopeError';
import {
  analyzeScope,
  offTopicRejectionNote,
  SCOPE_REJECTION_MESSAGE,
} from '../../domain/scopeClassifier';
import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { PatientContextRetriever, RetrievedPatientContext } from '../../domain/PatientContextRetriever';
import type { ChatThreadRepository } from '../../domain/repositories/ChatThreadRepository';
import type { MessageScope, SendMessageResultDto } from '../AssistantReadModels';
import type { SendChatMessageMessage } from './SendChatMessageMessage';

/**
 * Caso de uso central del asistente. Orden OBLIGATORIO de guardrails:
 *
 *  1. Validación de longitud (en el mensaje del caso de uso).
 *  2. Clasificador de alcance, SIEMPRE primero: si la pregunta queda fuera del
 *     alcance se persiste la respuesta fija de rechazo y NO se toca el
 *     retriever ni el motor de IA.
 *  3. Retrieval acotado por owner_user_id (el retriever ya viene construido
 *     con el dueño en sesión; aquí solo se eligen pacientes de su lista).
 *  4. En preguntas mixtas, se antepone el rechazo explícito de la parte fuera
 *     de tema y solo se responde la parte clínica.
 */
/**
 * Puerto de auditoría: registra que la IA recuperó contexto clínico de un paciente. La capa de
 * aplicación se mantiene pura (no importa la infra de bitácora); el dueño en sesión lo inyecta como
 * closure desde la fábrica → la traza queda atada al owner correcto. Default no-op para tests.
 */
export type AuditAiAccess = (patientId: string) => Promise<void>;

/**
 * Fragmento del streaming del chat. `delta` = trozo de texto para pintar en vivo;
 * `done` = resultado final AUTORITATIVO (DTO con ids/título/mensajes persistidos)
 * que el cliente usa para reconciliar la burbuja en vivo con lo que se guardó.
 */
export type ChatStreamFrame =
  | { type: 'delta'; text: string }
  | { type: 'done'; result: SendMessageResultDto };

/** Resultado de la secuencia de guardrails (prepare), listo para responder + finalizar. */
interface PreparedMessage {
  thread: ChatThread;
  patients: { id: string; fullName: string }[];
  context: RetrievedPatientContext | null;
  scope: MessageScope;
  /** No-null SOLO si la pregunta se rechazó: el motor NO se toca. */
  rejectionText: string | null;
  /** No-null en preguntas mixtas: nota de rechazo de la parte fuera de tema (va como prefijo). */
  offTopicNote: string | null;
  /**
   * Mensaje del usuario creado en prepare(), no en finalize(): su created_at debe
   * ser el momento de RECEPCIÓN, no el fin del stream (segundos después) — si no,
   * la hora de la burbuja "salta" al reconciliar en el cliente.
   */
  userMessage: ChatMessage;
}

export class SendChatMessage {
  public constructor(
    private readonly threads: ChatThreadRepository,
    private readonly retriever: PatientContextRetriever,
    private readonly engine: AssistantEngine,
    private readonly auditAiAccess: AuditAiAccess = async () => {},
  ) {}

  public async execute(message: SendChatMessageMessage): Promise<SendMessageResultDto> {
    const prepared = await this.prepare(message);
    let assistantText: string;
    if (prepared.rejectionText !== null) {
      // Rechazo con mensaje fijo (resuelto en prepare): el motor de IA NO se toca.
      assistantText = prepared.rejectionText;
    } else {
      const answer = await this.engine.answer(message.content, prepared.context);
      assistantText = this.compose(prepared.offTopicNote, answer);
    }
    return this.finalize(prepared, message, assistantText);
  }

  /**
   * Igual que execute() pero en STREAMING. COMPARTE prepare()/finalize() con
   * execute(), así que los guardrails (alcance default-deny, consentimiento-IA
   * dentro del retriever, traza de habeas data, persistencia) son EXACTAMENTE
   * los mismos: solo cambia cómo se obtiene la respuesta (deltas del motor vs.
   * texto completo). Emite fragmentos `delta` para pintar en vivo y un `done`
   * final con el DTO persistido. En rechazo, emite el mensaje fijo sin motor.
   *
   * Si el CONSUMIDOR aborta a mitad (cliente desconectado → return() del
   * iterador), el finally persiste el turno con lo ya emitido: el usuario LEYÓ
   * esa respuesta y los tokens ya se consumieron; perderla dejaría la
   * conversación inconsistente con lo que vio. Si el MOTOR lanza, no se
   * persiste nada (mismo contrato que execute(), que tampoco persiste al fallar).
   */
  public async *executeStream(message: SendChatMessageMessage): AsyncGenerator<ChatStreamFrame> {
    const prepared = await this.prepare(message);
    let assistantText = '';
    let finalized = false;
    let failed = false;
    try {
      if (prepared.rejectionText !== null) {
        assistantText = prepared.rejectionText;
        yield { type: 'delta', text: assistantText };
      } else {
        if (prepared.offTopicNote !== null) {
          // (4) Pregunta mixta: el rechazo explícito de la parte fuera de tema va primero.
          const prefix = `${prepared.offTopicNote}\n\n`;
          assistantText += prefix;
          yield { type: 'delta', text: prefix };
        }
        for await (const delta of this.engine.answerStream(message.content, prepared.context)) {
          assistantText += delta;
          yield { type: 'delta', text: delta };
        }
      }
      const result = await this.finalize(prepared, message, assistantText);
      finalized = true;
      yield { type: 'done', result };
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!finalized && !failed && assistantText.trim() !== '') {
        await this.finalize(prepared, message, assistantText);
      }
    }
  }

  /** Antepone el rechazo de la parte fuera de tema en preguntas mixtas (o deja la respuesta tal cual). */
  private compose(offTopicNote: string | null, answer: string): string {
    return offTopicNote !== null ? `${offTopicNote}\n\n${answer}` : answer;
  }

  /**
   * Secuencia OBLIGATORIA de guardrails ANTES de responder, compartida por
   * execute() y executeStream(): lista owner-scoped, resolución/creación del
   * hilo, clasificador de alcance (default-deny), retrieval acotado al dueño
   * (con el gate de consentimiento-IA dentro del retriever) y traza de habeas
   * data cuando de verdad se recuperó contexto clínico.
   */
  private async prepare(message: SendChatMessageMessage): Promise<PreparedMessage> {
    // Lista de pacientes PROPIOS (owner-scoped): alimenta el clasificador y el anclaje.
    const patients = await this.retriever.listPatients();

    let thread: ChatThread;
    if (message.threadId !== null) {
      const existing = await this.threads.findById(message.threadId);
      if (!existing) throw new ChatThreadNotFoundError(message.threadId);
      thread = existing;
    } else {
      const anchorId = this.validatedPatientId(message.patientId, patients);
      thread = ChatThread.create({ id: randomUUID(), patientId: anchorId, firstQuestion: message.content });
    }

    // (2) Clasificador de alcance ANTES de cualquier retrieval o respuesta.
    const analysis = analyzeScope(message.content, {
      knownPatientNames: patients.map((patient) => patient.fullName),
      hasAnchoredPatient: thread.anchoredPatientId() !== null,
    });

    // El mensaje del usuario nace aquí (momento de recepción) — ver PreparedMessage.
    const userMessage = ChatMessage.create({
      id: randomUUID(),
      threadId: thread.threadId(),
      role: 'usuario',
      content: message.content,
    });

    if (analysis.verdict === 'rechazado') {
      // Rechazo con mensaje fijo: ni retrieval ni motor de IA.
      return {
        thread,
        patients,
        context: null,
        scope: 'rechazado',
        rejectionText: SCOPE_REJECTION_MESSAGE,
        offTopicNote: null,
        userMessage,
      };
    }

    const targetPatientId =
      thread.anchoredPatientId() ??
      (analysis.matchedPatientName !== null
        ? (patients.find((patient) => patient.fullName === analysis.matchedPatientName)?.id ?? null)
        : null);

    // (3) Retrieval estructuralmente acotado al dueño (filtro en SQL) + gate de consentimiento-IA.
    const context = targetPatientId !== null ? await this.retriever.retrieve(targetPatientId) : null;
    // Traza de habeas data: SOLO cuando de verdad se recuperó y descifró contexto clínico de un
    // paciente para enviarlo a la IA (no en preguntas de plataforma/agenda sin paciente). Sin esto
    // el acceso de la IA al expediente quedaría sin rastro ("el guard del asistente falla abierto").
    if (targetPatientId !== null && context !== null) {
      await this.auditAiAccess(targetPatientId);
    }

    const offTopicNote = analysis.offTopicParts.length > 0 ? offTopicRejectionNote(analysis.offTopicParts) : null;
    return {
      thread,
      patients,
      context,
      scope: offTopicNote !== null ? 'mixto' : 'permitido',
      rejectionText: null,
      offTopicNote,
      userMessage,
    };
  }

  /** Persiste el turno (mensajes de usuario y asistente + título/fecha del hilo) y arma el DTO. */
  private async finalize(
    prepared: PreparedMessage,
    message: SendChatMessageMessage,
    assistantText: string,
  ): Promise<SendMessageResultDto> {
    const { patients, scope, userMessage } = prepared;
    const assistantMessage = ChatMessage.create({
      id: randomUUID(),
      threadId: prepared.thread.threadId(),
      role: 'asistente',
      content: assistantText,
    });

    // Releer el hilo antes de guardar: entre prepare() y aquí corre TODO el
    // streaming (segundos) y el usuario pudo anclar/desanclar paciente en
    // paralelo (AnchorThreadPatient). Guardar el snapshot de prepare() pisaría
    // ese cambio, porque el upsert incluye patient_id. Para hilos nuevos (aún
    // no guardados) se usa el creado en prepare().
    const thread = (await this.threads.findById(prepared.thread.threadId())) ?? prepared.thread;
    thread.ensureTitleFrom(message.content);
    thread.touch();
    await this.threads.save(thread);
    await this.threads.appendMessage(userMessage);
    await this.threads.appendMessage(assistantMessage);

    const threadPrimitives = thread.toPrimitives();
    const anchored = patients.find((patient) => patient.id === threadPrimitives.patientId) ?? null;
    return {
      threadId: threadPrimitives.id,
      threadTitle: threadPrimitives.title,
      patientId: threadPrimitives.patientId,
      patientName: anchored ? anchored.fullName : null,
      scope,
      userMessage: this.toDto(userMessage),
      assistantMessage: this.toDto(assistantMessage),
    };
  }

  private validatedPatientId(
    patientId: string | null,
    patients: { id: string; fullName: string }[],
  ): string | null {
    if (patientId === null || patientId === '') return null;
    if (!patients.some((patient) => patient.id === patientId)) throw new PatientNotInOwnerScopeError();
    return patientId;
  }

  private toDto(chatMessage: ChatMessage) {
    const primitives = chatMessage.toPrimitives();
    return {
      id: primitives.id,
      role: primitives.role,
      content: primitives.content,
      createdAt: primitives.createdAt,
    };
  }
}
