import { randomBytes, randomUUID } from 'node:crypto';
import { UserAccount } from '../../domain/UserAccount';
import { Subscription } from '../../domain/Subscription';
import { OrganizationMembership, type OrganizationMemberRole } from '../../domain/OrganizationMembership';
import { MembershipPermissions } from '../../domain/value-objects/MembershipPermissions';
import type { UserRole } from '../../domain/value-objects/UserRole';
import { EmailAlreadyRegisteredError } from '../../domain/errors/EmailAlreadyRegisteredError';
import { OrganizationNotFoundError } from '../../domain/errors/OrganizationNotFoundError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { OrganizationRepository } from '../../domain/repositories/OrganizationRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';
import type { AdminCreateUserMessage } from './AdminCreateUserMessage';

export interface AdminCreateUserResult {
  userId: string;
  /** Contraseña temporal generada (solo cuando el admin no fijó una). */
  temporaryPassword: string | null;
}

function memberRoleFor(role: UserRole): OrganizationMemberRole {
  if (role === 'org_master') return 'master';
  if (role === 'professor') return 'professor';
  return 'psychologist';
}

/**
 * Alta de cuentas desde /admin: rol explícito, suscripción ACTIVA (las cuentas
 * creadas por el admin no pagan) y membresía opcional a una organización.
 * Registra la acción en admin_audit_log.
 */
export class AdminCreateUser {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly organizations: OrganizationRepository,
    private readonly memberships: OrganizationMembershipRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly hasher: PasswordHasher,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async create(message: AdminCreateUserMessage): Promise<AdminCreateUserResult> {
    if (await this.accounts.findByEmail(message.emailValue())) {
      throw new EmailAlreadyRegisteredError(message.emailValue());
    }

    // La organización se valida ANTES de crear nada.
    const organization = message.organizationId()
      ? await this.organizations.findById(message.organizationId()!)
      : null;
    if (message.organizationId() && !organization) {
      throw new OrganizationNotFoundError(message.organizationId()!);
    }

    const generated = message.password() === null;
    const password = message.password() ?? randomBytes(6).toString('base64url');

    const account = UserAccount.provision(
      randomUUID(),
      message.emailValue(),
      this.hasher.hash(password),
      message.role(),
      message.actorUserId(),
    );
    await this.accounts.save(account);
    // Cuenta provisionada por el admin (no se auto-registró): correo verificado.
    await this.accounts.markEmailVerified(account.accountId());
    await this.profiles.createInitialProfile({
      userId: account.accountId(),
      fullName: message.fullName(),
      phone: '',
      phoneCountryCode: '+57',
    });
    // Cuentas creadas por el admin: activas sin pagar (sin paywall).
    await this.subscriptions.save(Subscription.startActive(randomUUID(), account.accountId()));

    if (organization) {
      const permissions =
        message.permissions() ??
        MembershipPermissions.fromJson(organization.toPrimitives().defaultMemberPoliciesJson);
      await this.memberships.save(
        OrganizationMembership.create(
          randomUUID(),
          organization.organizationId(),
          account.accountId(),
          memberRoleFor(message.role()),
          permissions,
        ),
      );
    }

    await this.audit.record({
      actorUserId: message.actorUserId(),
      action: 'crear_usuario',
      target: message.emailValue(),
      details: {
        userId: account.accountId(),
        role: message.role(),
        organizationId: organization ? organization.organizationId() : null,
      },
    });

    return { userId: account.accountId(), temporaryPassword: generated ? password : null };
  }
}
