import { describe, it, expect } from 'vitest';
import { SendChatMessage, type ChatStreamFrame } from '@/contexts/assistant/application/send-chat-message/SendChatMessage';
import { SendChatMessageMessage } from '@/contexts/assistant/application/send-chat-message/SendChatMessageMessage';
import { ChatThread } from '@/contexts/assistant/domain/ChatThread';
import { ChatMessage } from '@/contexts/assistant/domain/ChatMessage';
import { classifyScope, SCOPE_REJECTION_MESSAGE } from '@/contexts/assistant/domain/scopeClassifier';
import { EmptyChatMessageError } from '@/contexts/assistant/domain/errors/EmptyChatMessageError';
import { ChatMessageTooLongError } from '@/contexts/assistant/domain/errors/ChatMessageTooLongError';
import { PatientNotInOwnerScopeError } from '@/contexts/assistant/domain/errors/PatientNotInOwnerScopeError';
import type { AssistantEngine } from '@/contexts/assistant/domain/AssistantEngine';
import type {
  PatientContextRetriever,
  RetrievedPatientContext,
  RetrievedPatientSummary,
} from '@/contexts/assistant/domain/PatientContextRetriever';
import type { ChatThreadRepository, ChatThreadSummary } from '@/contexts/assistant/domain/repositories/ChatThreadRepository';

class InMemoryThreads implements ChatThreadRepository {
  public threads = new Map<string, ChatThread>();
  public messages: ChatMessage[] = [];

  async save(thread: ChatThread): Promise<void> {
    this.threads.set(thread.threadId(), thread);
  }
  async findById(threadId: string): Promise<ChatThread | null> {
    return this.threads.get(threadId) ?? null;
  }
  async listSummaries(): Promise<ChatThreadSummary[]> {
    return [];
  }
  async appendMessage(message: ChatMessage): Promise<void> {
    this.messages.push(message);
  }
  async listMessages(threadId: string): Promise<ChatMessage[]> {
    return this.messages.filter((m) => m.toPrimitives().threadId === threadId);
  }
}

function makeContext(name: string): RetrievedPatientContext {
  return {
    patient: {
      id: 'p1',
      fullName: name,
      gender: 'femenino',
      birthDate: null,
      consultationReason: 'Ansiedad',
      therapyStartDate: null,
      tags: [],
    },
    diagnoses: [],
    recentNotes: [],
    clinicalRecords: [],
    upcomingBookings: [],
  };
}

class FakeRetriever implements PatientContextRetriever {
  public retrieveCalls: string[] = [];
  constructor(private readonly patients: RetrievedPatientSummary[]) {}

  async listPatients(): Promise<RetrievedPatientSummary[]> {
    return this.patients;
  }
  async retrieve(patientId: string): Promise<RetrievedPatientContext | null> {
    this.retrieveCalls.push(patientId);
    const patient = this.patients.find((p) => p.id === patientId);
    return patient ? makeContext(patient.fullName) : null;
  }
}

class FakeEngine implements AssistantEngine {
  public answerCalls: Array<{ question: string; context: RetrievedPatientContext | null }> = [];

  classifyScope(question: string) {
    return classifyScope(question);
  }
  async answer(question: string, context: RetrievedPatientContext | null): Promise<string> {
    this.answerCalls.push({ question, context });
    return 'RESPUESTA CLÍNICA';
  }
  async *answerStream(question: string, context: RetrievedPatientContext | null): AsyncGenerator<string> {
    yield await this.answer(question, context);
  }
  providerName(): 'local' {
    return 'local';
  }
}

function setup(patients: RetrievedPatientSummary[] = [{ id: 'p1', fullName: 'María García' }]) {
  const threads = new InMemoryThreads();
  const retriever = new FakeRetriever(patients);
  const engine = new FakeEngine();
  // Spy del puerto de auditoría: registra los patientId para los que se trazó acceso de IA.
  const auditCalls: string[] = [];
  const useCase = new SendChatMessage(threads, retriever, engine, async (patientId) => {
    auditCalls.push(patientId);
  });
  return { threads, retriever, engine, useCase, auditCalls };
}

describe('SendChatMessage — orden obligatorio de guardrails', () => {
  it('pregunta fuera de alcance: respuesta fija, SIN retrieval y SIN motor de IA', async () => {
    const { threads, retriever, engine, useCase, auditCalls } = setup();

    const result = await useCase.execute(
      new SendChatMessageMessage({ threadId: null, patientId: null, content: 'Escríbeme un poema sobre el mar' }),
    );

    expect(result.scope).toBe('rechazado');
    expect(result.assistantMessage.content).toBe(SCOPE_REJECTION_MESSAGE);
    expect(retriever.retrieveCalls).toEqual([]); // el retriever JAMÁS se tocó
    expect(engine.answerCalls).toEqual([]); // el motor JAMÁS se tocó
    expect(auditCalls).toEqual([]); // sin contexto clínico → sin traza de acceso de IA
    expect(threads.messages).toHaveLength(2); // pregunta + rechazo quedan persistidos
  });

  it('pregunta permitida con nombre de paciente: recupera contexto de ESE paciente', async () => {
    const { retriever, engine, useCase, auditCalls } = setup();

    const result = await useCase.execute(
      new SendChatMessageMessage({ threadId: null, patientId: null, content: '¿Qué notas tengo de María García?' }),
    );

    expect(result.scope).toBe('permitido');
    expect(retriever.retrieveCalls).toEqual(['p1']);
    expect(engine.answerCalls).toHaveLength(1);
    expect(engine.answerCalls[0].context?.patient.fullName).toBe('María García');
    expect(auditCalls).toEqual(['p1']); // se recuperó contexto clínico → queda traza de acceso de IA
    expect(result.assistantMessage.content).toBe('RESPUESTA CLÍNICA');
  });

  it('traza de habeas data: NO registra acceso cuando la pregunta no recupera contexto de un paciente', async () => {
    const { retriever, engine, useCase, auditCalls } = setup();

    // Pregunta de plataforma/agenda sin paciente: permitida pero sin contexto clínico recuperado.
    const result = await useCase.execute(
      new SendChatMessageMessage({ threadId: null, patientId: null, content: '¿Cuántas citas tengo esta semana?' }),
    );

    expect(result.scope).toBe('permitido');
    expect(retriever.retrieveCalls).toEqual([]); // ningún paciente identificado
    expect(engine.answerCalls).toHaveLength(1); // el motor sí responde (sin contexto)
    expect(auditCalls).toEqual([]); // sin descifrar datos de un paciente → sin traza
  });

  it('pregunta mixta: antepone el rechazo explícito de la parte fuera de tema', async () => {
    const { engine, useCase } = setup();

    const result = await useCase.execute(
      new SendChatMessageMessage({
        threadId: null,
        patientId: null,
        content: 'Háblame de María García pero antes ayúdame a programar',
      }),
    );

    expect(result.scope).toBe('mixto');
    expect(result.assistantMessage.content).toContain('fuera de mi alcance');
    expect(result.assistantMessage.content).toContain('programación/código');
    expect(result.assistantMessage.content).toContain('RESPUESTA CLÍNICA');
    expect(engine.answerCalls).toHaveLength(1); // solo se responde la parte clínica
  });

  it('hilo con paciente anclado: el seguimiento corto usa el contexto anclado', async () => {
    const { threads, retriever, useCase } = setup();
    const thread = ChatThread.create({ id: 'hilo-1', patientId: 'p1' });
    await threads.save(thread);

    const result = await useCase.execute(
      new SendChatMessageMessage({ threadId: 'hilo-1', patientId: null, content: '¿Cómo ha evolucionado?' }),
    );

    expect(result.scope).toBe('permitido');
    expect(retriever.retrieveCalls).toEqual(['p1']);
  });

  it('anclar un paciente que NO es del dueño lanza PatientNotInOwnerScopeError', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute(
        new SendChatMessageMessage({ threadId: null, patientId: 'paciente-ajeno', content: 'Notas de mi paciente' }),
      ),
    ).rejects.toBeInstanceOf(PatientNotInOwnerScopeError);
  });

  it('valida longitud y contenido vacío (guardrail nº 3)', () => {
    expect(
      () => new SendChatMessageMessage({ threadId: null, patientId: null, content: '   ' }),
    ).toThrow(EmptyChatMessageError);
    expect(
      () => new SendChatMessageMessage({ threadId: null, patientId: null, content: 'a'.repeat(2001) }),
    ).toThrow(ChatMessageTooLongError);
  });
});

/** Vacía el generador de streaming en {deltas, texto concatenado, DTO del frame done}. */
async function drain(gen: AsyncGenerator<ChatStreamFrame>) {
  const deltas: string[] = [];
  let done: Extract<ChatStreamFrame, { type: 'done' }>['result'] | null = null;
  for await (const frame of gen) {
    if (frame.type === 'delta') deltas.push(frame.text);
    else done = frame.result;
  }
  return { deltas, text: deltas.join(''), done };
}

describe('SendChatMessage.executeStream — mismos guardrails, respuesta en streaming', () => {
  it('permitida con nombre de paciente: streamea deltas + done con el DTO persistido y traza el acceso', async () => {
    const { threads, retriever, engine, useCase, auditCalls } = setup();

    const { text, done, deltas } = await drain(
      useCase.executeStream(
        new SendChatMessageMessage({ threadId: null, patientId: null, content: '¿Qué notas tengo de María García?' }),
      ),
    );

    expect(deltas.length).toBeGreaterThan(0); // hubo streaming
    expect(text).toBe('RESPUESTA CLÍNICA'); // concatenación de deltas == respuesta del motor
    expect(done?.scope).toBe('permitido');
    expect(done?.assistantMessage.content).toBe('RESPUESTA CLÍNICA'); // texto persistido == streamado
    expect(retriever.retrieveCalls).toEqual(['p1']);
    expect(engine.answerCalls).toHaveLength(1); // el motor se invocó (vía answerStream)
    expect(auditCalls).toEqual(['p1']); // se recuperó contexto clínico → traza de acceso de IA
    expect(threads.messages).toHaveLength(2); // pregunta + respuesta persistidas al done
  });

  it('fuera de alcance: streamea el mensaje fijo SIN tocar el retriever ni el motor', async () => {
    const { retriever, engine, useCase, auditCalls } = setup();

    const { text, done } = await drain(
      useCase.executeStream(
        new SendChatMessageMessage({ threadId: null, patientId: null, content: 'Escríbeme un poema sobre el mar' }),
      ),
    );

    expect(text).toBe(SCOPE_REJECTION_MESSAGE);
    expect(done?.scope).toBe('rechazado');
    expect(retriever.retrieveCalls).toEqual([]); // retriever intacto
    expect(engine.answerCalls).toEqual([]); // motor intacto (no se streameó IA real)
    expect(auditCalls).toEqual([]); // sin contexto → sin traza
  });

  it('stream ABORTADO a mitad (cliente desconectado): el turno se persiste con lo ya emitido', async () => {
    const { threads, useCase } = setup();

    const gen = useCase.executeStream(
      new SendChatMessageMessage({ threadId: null, patientId: null, content: '¿Qué notas tengo de María García?' }),
    );
    // Consumir hasta el primer delta y abortar (equivale a cerrar la pestaña):
    const first = await gen.next();
    expect(first.done).toBe(false);
    await gen.return(undefined as never);

    // El finally del caso de uso persistió pregunta + respuesta parcial: el usuario
    // LEYÓ ese texto; sin esto la conversación desaparecía al recargar.
    expect(threads.messages).toHaveLength(2);
    expect(threads.messages[0].toPrimitives().role).toBe('usuario');
    expect(threads.messages[1].toPrimitives().content).toBe('RESPUESTA CLÍNICA');
  });

  it('el MOTOR lanza: NO se persiste nada (mismo contrato que execute)', async () => {
    const threads = new InMemoryThreads();
    const retriever = new FakeRetriever([{ id: 'p1', fullName: 'María García' }]);
    const engineQueFalla = {
      classifyScope,
      answer: async () => {
        throw new Error('API caída');
      },
      // eslint-disable-next-line require-yield
      answerStream: async function* (): AsyncGenerator<string> {
        throw new Error('API caída');
      },
      providerName: () => 'local' as const,
    };
    const useCase = new SendChatMessage(threads, retriever, engineQueFalla as never, async () => {});

    const gen = useCase.executeStream(
      new SendChatMessageMessage({ threadId: null, patientId: null, content: '¿Qué notas tengo de María García?' }),
    );
    await expect(async () => {
      for await (const frame of gen) void frame;
    }).rejects.toThrow('API caída');

    expect(threads.messages).toHaveLength(0); // sin persistencia en fallo del motor
  });

  it('mixta: antepone el rechazo de la parte fuera de tema al inicio del stream', async () => {
    const { engine, useCase } = setup();

    const { text, done, deltas } = await drain(
      useCase.executeStream(
        new SendChatMessageMessage({
          threadId: null,
          patientId: null,
          content: 'Háblame de María García pero antes ayúdame a programar',
        }),
      ),
    );

    expect(done?.scope).toBe('mixto');
    expect(deltas[0]).toContain('fuera de mi alcance'); // el prefijo va PRIMERO en el stream
    expect(text).toContain('programación/código');
    expect(text).toContain('RESPUESTA CLÍNICA');
    expect(done?.assistantMessage.content).toBe(text); // lo persistido == lo streameado
    expect(engine.answerCalls).toHaveLength(1);
  });
});
