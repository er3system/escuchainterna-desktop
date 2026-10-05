import { randomBytes, randomUUID } from 'node:crypto';
import { EmailVerificationToken } from '../../domain/EmailVerificationToken';
import type { EmailVerificationNotifier } from '../../domain/EmailVerificationNotifier';
import type { EmailVerificationTokenRepository } from '../../domain/repositories/EmailVerificationTokenRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

export interface EmailVerificationRequestResult {
  /**
   * Enlace de verificación. En producción solo viaja por correo; no se expone al
   * cliente (igual que el reset de contraseña). Se devuelve para uso interno/tests.
   * null cuando el usuario no existe.
   */
  verifyUrl: string | null;
}

/** Genera token de 7 días y "envía" el correo vía outbox (template verificar_correo). */
export class RequestEmailVerification {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly notifier: EmailVerificationNotifier,
  ) {}

  public async request(userId: string, baseUrl: string): Promise<EmailVerificationRequestResult> {
    const account = await this.accounts.findById(userId);
    if (!account) return { verifyUrl: null };

    const token = EmailVerificationToken.issue(randomUUID(), account.accountId(), randomBytes(24).toString('hex'));
    await this.tokens.save(token);

    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verificar/${token.tokenValue()}`;
    await this.notifier.sendVerificationLink({
      userId: account.accountId(),
      email: account.accountEmail(),
      fullName: '',
      verifyUrl,
    });
    return { verifyUrl };
  }
}
