import { ChatThreadNotFoundError } from '../../domain/errors/ChatThreadNotFoundError';
import { PatientNotInOwnerScopeError } from '../../domain/errors/PatientNotInOwnerScopeError';
import type { ChatThreadRepository } from '../../domain/repositories/ChatThreadRepository';
import type { PatientContextRetriever } from '../../domain/PatientContextRetriever';

/**
 * Cambia el paciente anclado a un hilo ("Hablar sobre: [paciente]").
 * El paciente DEBE pertenecer al dueño en sesión (lista del retriever
 * acotado por owner) y el hilo también (repo acotado por owner).
 */
export class AnchorThreadPatient {
  public constructor(
    private readonly threads: ChatThreadRepository,
    private readonly retriever: PatientContextRetriever,
  ) {}

  public async anchor(threadId: string, patientId: string | null): Promise<void> {
    const thread = await this.threads.findById(threadId);
    if (!thread) throw new ChatThreadNotFoundError(threadId);

    const normalized = patientId === null || patientId === '' ? null : patientId;
    if (normalized !== null) {
      const patients = await this.retriever.listPatients();
      const isOwn = patients.some((patient) => patient.id === normalized);
      if (!isOwn) throw new PatientNotInOwnerScopeError();
    }

    thread.anchorPatient(normalized);
    await this.threads.save(thread);
  }
}
