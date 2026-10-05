import { DomainError } from '@/shared/domain/DomainError';

export class ChatMessageTooLongError extends DomainError {
  public constructor(maxLength: number) {
    super(`El mensaje es demasiado largo: el límite es de ${maxLength} caracteres.`);
  }
}
