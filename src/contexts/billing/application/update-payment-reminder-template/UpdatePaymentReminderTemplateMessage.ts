const MAX_BODY_LENGTH = 4000;

export class UpdatePaymentReminderTemplateMessage {
  private readonly content: string;

  public constructor(input: { body: string }) {
    const body = input.body.trim();
    if (!body) throw new Error('El contenido del recordatorio no puede quedar vacío.');
    if (body.length > MAX_BODY_LENGTH) {
      throw new Error(`El recordatorio no puede exceder ${MAX_BODY_LENGTH} caracteres.`);
    }
    this.content = body;
  }

  public body(): string {
    return this.content;
  }
}
