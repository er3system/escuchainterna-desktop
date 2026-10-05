import { Email } from '@haskou/value-objects';
import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '../../domain/value-objects/MembershipPermissions';
import { InvalidMemberRoleError } from './InvalidMemberRoleError';

export type CreatableMemberRole = 'psychologist' | 'professor';

/**
 * Alta de un miembro desde el hub de organización: convierte primitivos
 * del formulario a VOs una sola vez (correo, rol de miembro y permisos).
 */
export class CreateOrganizationMemberMessage {
  private readonly memberEmail: Email;
  private readonly name: string;
  private readonly role: CreatableMemberRole;
  private readonly memberPermissions: MembershipPermissions;

  public constructor(
    private readonly input: {
      organizationId: string;
      actorUserId: string;
      fullName: string;
      email: string;
      memberRole: string;
      permissions: MembershipPermissionsPrimitives;
    },
  ) {
    this.memberEmail = new Email(input.email.trim().toLowerCase());
    this.name = input.fullName.trim();
    if (!this.name) throw new Error('El nombre completo del miembro es obligatorio.');
    if (input.memberRole !== 'psychologist' && input.memberRole !== 'professor') {
      throw new InvalidMemberRoleError(input.memberRole);
    }
    this.role = input.memberRole;
    this.memberPermissions = MembershipPermissions.fromPrimitives(input.permissions);
  }

  public organizationId(): string {
    return this.input.organizationId;
  }

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public emailValue(): string {
    return this.memberEmail.toString();
  }

  public fullName(): string {
    return this.name;
  }

  public memberRole(): CreatableMemberRole {
    return this.role;
  }

  public permissions(): MembershipPermissions {
    return this.memberPermissions;
  }
}
