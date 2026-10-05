import type { ChatThreadRepository } from '../../domain/repositories/ChatThreadRepository';
import type { PatientContextRetriever } from '../../domain/PatientContextRetriever';
import type { ThreadDetailDto } from '../AssistantReadModels';

/** Detalle de un hilo (mensajes incluidos) del dueño en sesión; null si no es suyo. */
export class GetThreadDetail {
  public constructor(
    private readonly threads: ChatThreadRepository,
    private readonly retriever: PatientContextRetriever,
  ) {}

  public async get(threadId: string): Promise<ThreadDetailDto | null> {
    const thread = await this.threads.findById(threadId);
    if (!thread) return null;

    const primitives = thread.toPrimitives();
    const patientName =
      primitives.patientId !== null
        ? ((await this.retriever.listPatients()).find((patient) => patient.id === primitives.patientId)?.fullName ?? null)
        : null;

    const messages = await this.threads.listMessages(threadId);
    return {
      id: primitives.id,
      title: primitives.title,
      patientId: primitives.patientId,
      patientName,
      messages: messages.map((message) => {
        const m = message.toPrimitives();
        return { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt };
      }),
    };
  }
}
