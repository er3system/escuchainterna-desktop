import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '../../domain/value-objects/MembershipPermissions';

/** Edición de permisos de un miembro: valida el VO de permisos una sola vez. */
export class UpdateMemberPermissionsMessage {
  private readonly memberPermissions: MembershipPermissions;

  public constructor(
    private readonly input: {
      organizationId: string;
      actorUserId: string;
      memberUserId: string;
      permissions: MembershipPermissionsPrimitives;
    },
  ) {
    this.memberPermissions = MembershipPermissions.fromPrimitives(input.permissions);
  }

  public organizationId(): string {
    return this.input.organizationId;
  }

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public memberUserId(): string {
    return this.input.memberUserId;
  }

  public permissions(): MembershipPermissions {
    return this.memberPermissions;
  }
}
