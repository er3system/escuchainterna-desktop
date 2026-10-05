import { randomInt, randomUUID } from 'node:crypto';
import { Subscription } from '../../domain/Subscription';
import { UserAccount } from '../../domain/UserAccount';
import { EmailAlreadyRegisteredError } from '../../domain/errors/EmailAlreadyRegisteredError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import type { ConsultorioRepository } from '../../domain/repositories/ConsultorioRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { ReceptionConsultorioRepository } from '../../domain/repositories/ReceptionConsultorioRepository';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';

export interface CreateReceptionInput {
  organizationId: string;
  actorUserId: string;
  fullName: string;
  email: string;
  /** Consultorios que atenderá la recepción (al menos uno, todos de esta org). */
  consultorioIds: string[];
}

export interface CreatedReception {
  userId: string;
  /** Se muestra UNA sola vez; el maestro la comparte con la recepción. */
  temporaryPassword: string;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTemporaryPassword(length = 12): string {
  let password = '';
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

/**
 * Alta de una RECEPCIÓN multi-consultorio (consultorios-spec §5): el org_master crea una
 * cuenta role='assistant' ligada a la ORGANIZACIÓN y a N consultorios (no a un titular,
 * por eso NO crea fila en `assistants`). Provisiona la cuenta + perfil + suscripción
 * activa (sin paywall, como los miembros) igual que un asistente, y registra los
 * consultorios en `reception_consultorios`. Solo el maestro de la org puede crearla.
 */
export class CreateReception {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly reception: ReceptionConsultorioRepository,
    private readonly memberships: OrganizationMembershipRepository,
    private readonly consultorios: ConsultorioRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly hasher: PasswordHasher,
  ) {}

  public async create(input: CreateReceptionInput): Promise<CreatedReception> {
    await this.assertActorIsMaster(input.actorUserId, input.organizationId);

    const consultorioIds = [...new Set(input.consultorioIds.filter(Boolean))];
    if (consultorioIds.length === 0) {
      throw new Error('Elige al menos un consultorio para la recepción.');
    }
    for (const consultorioId of consultorioIds) {
      if (!(await this.consultorios.findByIdInOrganization(consultorioId, input.organizationId))) {
        throw new Error('Algún consultorio no pertenece a esta organización.');
      }
    }

    const email = input.email.trim().toLowerCase();
    if (await this.accounts.findByEmail(email)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const temporaryPassword = generateTemporaryPassword();
    const account = UserAccount.provision(
      randomUUID(),
      email,
      this.hasher.hash(temporaryPassword),
      'assistant',
      input.actorUserId,
    );
    await this.accounts.save(account);
    // Cuenta provisionada por la organización (no se auto-registró): correo verificado.
    await this.accounts.markEmailVerified(account.accountId());

    await this.profiles.createInitialProfile({
      userId: account.accountId(),
      fullName: input.fullName.trim(),
      phone: '',
      phoneCountryCode: '+57',
    });

    // Cubierta por la organización: sin paywall (igual que los asistentes y miembros).
    await this.subscriptions.save(Subscription.startActive(randomUUID(), account.accountId()));

    await this.reception.setConsultorios(account.accountId(), input.organizationId, consultorioIds);

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
