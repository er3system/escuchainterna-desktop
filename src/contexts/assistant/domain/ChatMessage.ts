export type ChatRole = 'usuario' | 'asistente';

export interface ChatMessagePrimitives {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

/** Mensaje de un hilo del asistente (burbujas usuario / asistente). */
export class ChatMessage {
  private constructor(
    private readonly id: string,
    private readonly threadId: string,
    private readonly role: ChatRole,
    private readonly content: string,
    private readonly createdAt: Date,
  ) {}

  public static create(input: { id: string; threadId: string; role: ChatRole; content: string }): ChatMessage {
    return new ChatMessage(input.id, input.threadId, input.role, input.content, new Date());
  }

  public static fromPrimitives(primitives: ChatMessagePrimitives): ChatMessage {
    return new ChatMessage(
      primitives.id,
      primitives.threadId,
      primitives.role,
      primitives.content,
      new Date(primitives.createdAt),
    );
  }

  public toPrimitives(): ChatMessagePrimitives {
    return {
      id: this.id,
      threadId: this.threadId,
      role: this.role,
      content: this.content,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
