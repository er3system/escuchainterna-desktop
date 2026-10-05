import { EmptyChatMessageError } from '../../domain/errors/EmptyChatMessageError';
import { ChatMessageTooLongError } from '../../domain/errors/ChatMessageTooLongError';
import { MAX_QUESTION_LENGTH } from '../../domain/scopeClassifier';

export interface SendChatMessageInput {
  /** Hilo existente; null crea uno nuevo. */
  threadId: string | null;
  /** Paciente a anclar si el hilo es nuevo (debe ser del dueño en sesión). */
  patientId: string | null;
  content: string;
}

/** Mensaje del caso de uso: valida los primitivos una sola vez. */
export class SendChatMessageMessage {
  public readonly threadId: string | null;
  public readonly patientId: string | null;
  public readonly content: string;

  public constructor(input: SendChatMessageInput) {
    const content = input.content.trim();
    if (content.length === 0) throw new EmptyChatMessageError();
    if (content.length > MAX_QUESTION_LENGTH) throw new ChatMessageTooLongError(MAX_QUESTION_LENGTH);

    this.threadId = input.threadId;
    this.patientId = input.patientId;
    this.content = content;
  }
}
