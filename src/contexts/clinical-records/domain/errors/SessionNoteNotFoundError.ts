import { DomainError } from '@/shared/domain/DomainError';

export class SessionNoteNotFoundError extends DomainError {
  public constructor(noteId: string) {
    super(`No existe la nota de sesión "${noteId}".`);
  }
}
