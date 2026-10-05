import { randomInt, randomUUID } from 'node:crypto';
import { Assistant } from '../../domain/Assistant';
import { Subscription } from '../../domain/Subscription';
import { UserAccount } from '../../domain/UserAccount';
import { EmailAlreadyRegisteredError } from '../../domain/errors/EmailAlreadyRegisteredError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import type { AssistantRepository } from '../../domain/repositories/AssistantRepository';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import { AssistantCreationNotAllowedError } from './AssistantCreationNotAllowedError';
import { CreateAssistantMessage } from './CreateAssistantMessage';

export interface CreatedAssistant {
  userId: string;
  /** Se muestra UNA sola vez al titular; el asistente debe cambiarla al entrar. */
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
 * Alta de asistente/recepcionista (v3 §4): crea la cuenta (role='assistant'),
 * el perfil inicial, una suscripción ACTIVA cubierta por el titular (nunca cae
 * en el paywall) y el vínculo en `assistants`. Devuelve la contraseña temporal.
 * Un asistente no puede crear otros asistentes.
 */
export class CreateAssistant {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly assistants: AssistantRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly hasher: PasswordHasher,
  ) {}

  public async create(message: CreateAssistantMessage): Promise<CreatedAssistant> {
    const actor = await this.accounts.findById(message.ownerUserId());
    if (!actor || actor.accountRole() === 'assistant') {
      throw new AssistantCreationNotAllowedError();
    }

    if (await this.accounts.findByEmail(message.emailValue())) {
      throw new EmailAlreadyRegisteredError(message.emailValue());
    }

    const temporaryPassword = generateTemporaryPassword();
    const account = UserAccount.provision(
      randomUUID(),
      message.emailValue(),
      this.hasher.hash(temporaryPassword),
      'assistant',
      message.ownerUserId(),
    );
    await this.accounts.save(account);
    // Cuenta provisionada por el titular (no se auto-registró): el correo se da por
    // verificado para que no vea el banner de confirmación.
    await this.accounts.markEmailVerified(account.accountId());

    await this.profiles.createInitialProfile({
      userId: account.accountId(),
      fullName: message.fullName(),
      phone: '',
      phoneCountryCode: '+57',
    });

    // Cubierta por el titular (como los miembros de organización): sin paywall.
    await this.subscriptions.save(Subscription.startActive(randomUUID(), account.accountId()));

    await this.assistants.save(Assistant.create(randomUUID(), message.ownerUserId(), account.accountId()));

    return { userId: account.accountId(), temporaryPassword };
  }
}
