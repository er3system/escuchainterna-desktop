import { Assistant } from '../Assistant';

export interface AssistantRepository {
  save(assistant: Assistant): Promise<void>;
  /** Vínculo de la cuenta asistente (assistant_user_id es UNIQUE). */
  findByAssistantUserId(assistantUserId: string): Promise<Assistant | null>;
  listByOwner(ownerUserId: string): Promise<Assistant[]>;
}
