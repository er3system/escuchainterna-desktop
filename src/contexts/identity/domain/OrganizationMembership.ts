import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { MembershipPermissions } from './value-objects/MembershipPermissions';

export type OrganizationMemberRole = 'master' | 'professor' | 'psychologist';

export interface OrganizationMembershipPrimitives {
  id: string;
  organizationId: string;
  userId: string;
  memberRole: OrganizationMemberRole;
  permissionsJson: string;
  /** Consultorio al que pertenece el miembro (NULL = master / sin consultorio). */
  consultorioId: string | null;
  createdAt: string;
}

/** Pertenencia de un usuario a una organización, con sus permisos. */
export class OrganizationMembership extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly organizationId: string,
    private readonly userId: string,
    private readonly memberRole: OrganizationMemberRole,
    private permissions: MembershipPermissions,
    private consultorioId: string | null,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static create(
    id: string,
    organizationId: string,
    userId: string,
    memberRole: OrganizationMemberRole,
    permissions: MembershipPermissions,
    consultorioId: string | null = null,
  ): OrganizationMembership {
    return new OrganizationMembership(
      id,
      organizationId,
      userId,
      memberRole,
      permissions,
      consultorioId,
      new Date(),
    );
  }

  public static fromPrimitives(primitives: OrganizationMembershipPrimitives): OrganizationMembership {
    return new OrganizationMembership(
      primitives.id,
      primitives.organizationId,
      primitives.userId,
      primitives.memberRole,
      MembershipPermissions.fromJson(primitives.permissionsJson),
      primitives.consultorioId ?? null,
      new Date(primitives.createdAt),
    );
  }

  public membershipPermissions(): MembershipPermissions {
    return this.permissions;
  }

  public updatePermissions(permissions: MembershipPermissions): void {
    this.permissions = permissions;
  }

  public memberUserId(): string {
    return this.userId;
  }

  public membershipOrganizationId(): string {
    return this.organizationId;
  }

  /** Consultorio del miembro (NULL = master / sin consultorio). */
  public memberConsultorioId(): string | null {
    return this.consultorioId;
  }

  /** Mueve al miembro a un consultorio (o lo deja sin consultorio con null). */
  public assignConsultorio(consultorioId: string | null): void {
    this.consultorioId = consultorioId;
  }

  public toPrimitives(): OrganizationMembershipPrimitives {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      memberRole: this.memberRole,
      permissionsJson: this.permissions.toJson(),
      consultorioId: this.consultorioId,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
