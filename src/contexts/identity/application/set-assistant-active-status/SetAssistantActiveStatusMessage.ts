/** Activar/desactivar la cuenta de un asistente (solo su titular). */
export class SetAssistantActiveStatusMessage {
  public constructor(
    private readonly input: {
      /** Titular en sesión. */
      actorUserId: string;
      /** Cuenta del asistente a activar/desactivar. */
      assistantUserId: string;
      active: boolean;
    },
  ) {}

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public assistantUserId(): string {
    return this.input.assistantUserId;
  }

  public shouldBeActive(): boolean {
    return this.input.active;
  }
}
