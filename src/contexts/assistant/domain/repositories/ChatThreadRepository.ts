import type { ChatThread } from '../ChatThread';
import type { ChatMessage } from '../ChatMessage';

export interface ChatThreadSummary {
  id: string;
  title: string;
  patientId: string | null;
  patientName: string | null;
  updatedAt: string;
}

/**
 * Repositorio de hilos y mensajes del asistente, acotado al dueño en sesión:
 * toda consulta y escritura filtra por owner_user_id en SQL.
 */
export interface ChatThreadRepository {
  save(thread: ChatThread): Promise<void>;
  findById(threadId: string): Promise<ChatThread | null>;
  listSummaries(): Promise<ChatThreadSummary[]>;
  appendMessage(message: ChatMessage): Promise<void>;
  listMessages(threadId: string): Promise<ChatMessage[]>;
}
