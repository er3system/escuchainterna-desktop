import { DomainError } from '@/shared/domain/DomainError';

export class ChatThreadNotFoundError extends DomainError {
  public constructor(threadId: string) {
    super(`No encontramos la conversación "${threadId}".`);
  }
}
