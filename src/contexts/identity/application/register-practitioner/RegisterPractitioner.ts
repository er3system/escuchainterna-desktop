import { randomUUID } from 'node:crypto';
import { UserAccount } from '../../domain/UserAccount';
import { Subscription } from '../../domain/Subscription';
import { EmailAlreadyRegisteredError } from '../../domain/errors/EmailAlreadyRegisteredError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { ReferralRepository } from '../../domain/repositories/ReferralRepository';
import { DESKTOP_LEGAL_VERSIONS, LEGAL_VERSIONS } from '@/shared/legal/legalVersions';
import { RegisterPractitionerMessage } from './RegisterPractitionerMessage';

/**
 * Registro público v2: SIEMPRE crea rol psychologist, con perfil profesional
 * y suscripción de prueba de 7 días. Un correo solo puede registrarse una vez
 * (el bloqueo mono-cuenta de la v1 desaparece: ahora caben N profesionales).
 *
 * v3 §11: si el registro llega con ?ref=CODIGO válido se crea el referral con
 * status 'registrado' (un código inválido jamás bloquea el registro).
 */
export class RegisterPractitioner {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly hasher: PasswordHasher,
    private readonly referrals?: ReferralRepository,
    private readonly registrationMode: 'subscription' | 'local' = 'subscription',
  ) {}

  public async register(message: RegisterPractitionerMessage): Promise<string> {
    if (await this.accounts.findByEmail(message.emailValue())) {
      throw new EmailAlreadyRegisteredError(message.emailValue());
    }
    const account = UserAccount.registerPublic(
      randomUUID(),
      message.emailValue(),
      this.hasher.hash(message.password()),
    );
    await this.accounts.save(account);
    // Sella QUÉ versión de T&C/privacidad aceptó y CUÁNDO (la casilla ya se exigió en el
    // mensaje; antes el booleano se descartaba). Prueba de autorización informada (Ley 1581).
    const legalVersions = this.registrationMode === 'local' ? DESKTOP_LEGAL_VERSIONS : LEGAL_VERSIONS;
    await this.accounts.recordTermsAcceptance(account.accountId(), legalVersions.terms, legalVersions.privacy);
    await this.profiles.createInitialProfile({
      userId: account.accountId(),
      fullName: message.fullName(),
      phone: message.phoneNumber(),
      phoneCountryCode: message.phoneDialCode(),
    });
    if (this.registrationMode === 'subscription') {
      await this.subscriptions.save(Subscription.startTrial(randomUUID(), account.accountId()));
    }

    const code = message.referralCode();
    if (this.registrationMode === 'subscription' && code && this.referrals) {
      const referrerUserId = await this.referrals.findReferrerByCode(code);
      if (referrerUserId) await this.referrals.registerReferral(referrerUserId, account.accountId());
    }
    return account.accountId();
  }
}
