import type { ChatThreadRepository } from '../../domain/repositories/ChatThreadRepository';
import type { ThreadSummaryDto } from '../AssistantReadModels';

/** Lista los hilos del dueño en sesión (el repo ya viene acotado por owner). */
export class ListThreads {
  public constructor(private readonly threads: ChatThreadRepository) {}

  public async list(): Promise<ThreadSummaryDto[]> {
    return (await this.threads.listSummaries()).map((summary) => ({
      id: summary.id,
      title: summary.title,
      patientId: summary.patientId,
      patientName: summary.patientName,
      updatedAt: summary.updatedAt,
    }));
  }
}
