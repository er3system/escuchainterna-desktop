import { Email } from '@haskou/value-objects';
import { isUserRole, type UserRole } from '../../domain/value-objects/UserRole';
import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '../../domain/value-objects/MembershipPermissions';
import { assertStrongPassword } from '../../domain/value-objects/passwordPolicy';

/**
 * Alta de cuenta desde el hub de administración: rol explícito, organización
 * opcional y permisos de membresía opcionales (si no vienen, se usan las
 * políticas por defecto de la organización).
 */
export class AdminCreateUserMessage {
  private readonly actor: string;
  private readonly email: Email;
  private readonly name: string;
  private readonly accountRole: UserRole;
  private readonly plainPassword: string | null;
  private readonly orgId: string | null;
  private readonly memberPermissions: MembershipPermissions | null;

  public constructor(input: {
    actorUserId: string;
    email: string;
    fullName: string;
    role: string;
    /** Contraseña inicial; null/vacía ⇒ se genera una temporal. */
    password?: string | null;
    organizationId?: string | null;
    permissions?: MembershipPermissionsPrimitives | null;
  }) {
    this.actor = input.actorUserId;
    this.email = new Email(input.email.trim().toLowerCase());
    this.name = input.fullName.trim();
    if (!this.name) throw new Error('El nombre completo es obligatorio.');
    if (!isUserRole(input.role)) throw new Error(`Rol de plataforma inválido: "${input.role}".`);
    this.accountRole = input.role;
    const password = (input.password ?? '').trim();
    if (password) assertStrongPassword(password);
    this.plainPassword = password || null;
    this.orgId = input.organizationId?.trim() || null;
    this.memberPermissions = input.permissions
      ? MembershipPermissions.fromPrimitives(input.permissions)
      : null;
  }

  public actorUserId(): string {
    return this.actor;
  }

  public emailValue(): string {
    return this.email.toString();
  }

  public fullName(): string {
    return this.name;
  }

  public role(): UserRole {
    return this.accountRole;
  }

  public password(): string | null {
    return this.plainPassword;
  }

  public organizationId(): string | null {
    return this.orgId;
  }

  public permissions(): MembershipPermissions | null {
    return this.memberPermissions;
  }
}
