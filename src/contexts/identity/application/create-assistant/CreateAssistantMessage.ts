import { Email } from '@haskou/value-objects';

/**
 * Alta de un asistente/recepcionista (v3 §4): convierte los primitivos del
 * formulario a VOs una sola vez (correo normalizado, nombre obligatorio).
 */
export class CreateAssistantMessage {
  private readonly assistantEmail: Email;
  private readonly name: string;

  public constructor(
    private readonly input: {
      /** Titular en sesión que da de alta al asistente. */
      ownerUserId: string;
      fullName: string;
      email: string;
    },
  ) {
    this.assistantEmail = new Email(input.email.trim().toLowerCase());
    this.name = input.fullName.trim();
    if (!this.name) throw new Error('El nombre del asistente es obligatorio.');
  }

  public ownerUserId(): string {
    return this.input.ownerUserId;
  }

  public emailValue(): string {
    return this.assistantEmail.toString();
  }

  public fullName(): string {
    return this.name;
  }
}
