import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface ChatThreadPrimitives {
  id: string;
  title: string;
  patientId: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TITLE = 'Nueva conversación';
const MAX_TITLE_LENGTH = 60;

/**
 * Hilo de conversación del asistente de IA. Pertenece SIEMPRE a un dueño
 * (owner_user_id), aplicado por el repositorio; opcionalmente queda anclado a
 * un paciente del mismo dueño ("Hablar sobre: [paciente]").
 */
export class ChatThread extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private title: string,
    private patientId: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static create(input: { id: string; patientId: string | null; firstQuestion?: string }): ChatThread {
    const now = new Date();
    const title = input.firstQuestion ? ChatThread.titleFrom(input.firstQuestion) : DEFAULT_TITLE;
    return new ChatThread(input.id, title, input.patientId, now, now);
  }

  public static fromPrimitives(primitives: ChatThreadPrimitives): ChatThread {
    return new ChatThread(
      primitives.id,
      primitives.title,
      primitives.patientId,
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  private static titleFrom(question: string): string {
    const clean = question.replace(/\s+/g, ' ').trim();
    if (clean.length === 0) return DEFAULT_TITLE;
    return clean.length > MAX_TITLE_LENGTH ? `${clean.slice(0, MAX_TITLE_LENGTH - 1)}…` : clean;
  }

  public threadId(): string {
    return this.id;
  }

  public anchoredPatientId(): string | null {
    return this.patientId;
  }

  public anchorPatient(patientId: string | null): void {
    this.patientId = patientId;
    this.touch();
  }

  /** Si el hilo sigue con el título por defecto, toma uno de la pregunta. */
  public ensureTitleFrom(question: string): void {
    if (this.title === DEFAULT_TITLE) this.title = ChatThread.titleFrom(question);
  }

  public touch(): void {
    this.updatedAt = new Date();
  }

  public toPrimitives(): ChatThreadPrimitives {
    return {
      id: this.id,
      title: this.title,
      patientId: this.patientId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
