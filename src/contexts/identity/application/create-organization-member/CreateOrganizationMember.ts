import { randomInt, randomUUID } from 'node:crypto';
import { UserAccount } from '../../domain/UserAccount';
import { Subscription } from '../../domain/Subscription';
import { OrganizationMembership } from '../../domain/OrganizationMembership';
import { EmailAlreadyRegisteredError } from '../../domain/errors/EmailAlreadyRegisteredError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import { CreateOrganizationMemberMessage } from './CreateOrganizationMemberMessage';
import { NotOrganizationMasterError } from './NotOrganizationMasterError';

export interface CreatedOrganizationMember {
  userId: string;
  /** Se muestra UNA sola vez al maestro; el miembro debe cambiarla al entrar. */
  temporaryPassword: string;
}

/** Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para contraseñas legibles. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTemporaryPassword(length = 12): string {
  let password = '';
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

/**
 * Crea la cuenta de un miembro de la organización: usuario (psychologist o
 * professor), perfil inicial, suscripción ACTIVA (cubierta por la org, sin
 * paywall) y membresía con permisos. Devuelve la contraseña temporal.
 * Solo puede ejecutarlo el perfil maestro de esa organización.
 */
export class CreateOrganizationMember {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly memberships: OrganizationMembershipRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly hasher: PasswordHasher,
  ) {}

  public async create(message: CreateOrganizationMemberMessage): Promise<CreatedOrganizationMember> {
    await this.assertActorIsMaster(message.actorUserId(), message.organizationId());

    if (await this.accounts.findByEmail(message.emailValue())) {
      throw new EmailAlreadyRegisteredError(message.emailValue());
    }

    const temporaryPassword = generateTemporaryPassword();
    const account = UserAccount.provision(
      randomUUID(),
      message.emailValue(),
      this.hasher.hash(temporaryPassword),
      message.memberRole(),
      message.actorUserId(),
    );
    await this.accounts.save(account);
    // Cuenta provisionada por la organización (no se auto-registró): correo verificado.
    await this.accounts.markEmailVerified(account.accountId());

    await this.profiles.createInitialProfile({
      userId: account.accountId(),
      fullName: message.fullName(),
      phone: '',
      phoneCountryCode: '+57',
    });

    // Cubierta por la organización: nunca cae en el paywall.
    await this.subscriptions.save(Subscription.startActive(randomUUID(), account.accountId()));

    await this.memberships.save(
      OrganizationMembership.create(
        randomUUID(),
        message.organizationId(),
        account.accountId(),
        message.memberRole(),
        message.permissions(),
      ),
    );

    return { userId: account.accountId(), temporaryPassword };
  }

  private async assertActorIsMaster(actorUserId: string, organizationId: string): Promise<void> {
    const membership = await this.memberships.findByUserId(actorUserId);
    if (
      !membership ||
      membership.membershipOrganizationId() !== organizationId ||
      membership.toPrimitives().memberRole !== 'master'
    ) {
      throw new NotOrganizationMasterError();
    }
  }
}
