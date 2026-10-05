export class UpdateSessionNoteMessage {
  private readonly noteIdValue: string;
  private readonly patientIdValue: string;
  private readonly titleValue: string;
  private readonly contentValue: string;

  public constructor(input: { noteId: string; patientId: string; title: string; content: string }) {
    if (!input.noteId || !input.patientId) throw new Error('Faltan datos para actualizar la nota de sesión.');
    this.noteIdValue = input.noteId;
    this.patientIdValue = input.patientId;
    this.titleValue = input.title ?? '';
    this.contentValue = input.content ?? '';
  }

  public noteId(): string {
    return this.noteIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public title(): string {
    return this.titleValue;
  }

  public content(): string {
    return this.contentValue;
  }
}
