import { DomainError } from '@/shared/domain/DomainError';

export class EmptyChatMessageError extends DomainError {
  public constructor() {
    super('Escribe un mensaje para el asistente.');
  }
}
