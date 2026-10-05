/** Activar/desactivar la cuenta de un miembro de la organización. */
export class SetMemberActiveStatusMessage {
  public constructor(
    private readonly input: {
      organizationId: string;
      actorUserId: string;
      memberUserId: string;
      active: boolean;
    },
  ) {}

  public organizationId(): string {
    return this.input.organizationId;
  }

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public memberUserId(): string {
    return this.input.memberUserId;
  }

  public shouldBeActive(): boolean {
    return this.input.active;
  }
}
