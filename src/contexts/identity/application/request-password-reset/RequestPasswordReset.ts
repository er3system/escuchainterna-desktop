import { randomBytes, randomUUID } from 'node:crypto';
import { PasswordResetToken } from '../../domain/PasswordResetToken';
import type { PasswordResetNotifier } from '../../domain/PasswordResetNotifier';
import type { PasswordResetTokenRepository } from '../../domain/repositories/PasswordResetTokenRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

export interface PasswordResetRequestResult {
  /**
   * Enlace de recuperación. En producción solo viaja por correo; en local la
   * UI lo muestra con el aviso "(modo local: este enlace llegaría por correo)".
   * null cuando el correo no existe (no se revela si la cuenta existe).
   */
  resetUrl: string | null;
}

/** Genera token de 1 hora y "envía" el correo vía outbox (template recuperar_contrasena). */
export class RequestPasswordReset {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly tokens: PasswordResetTokenRepository,
    private readonly notifier: PasswordResetNotifier,
  ) {}

  public async request(email: string, baseUrl: string): Promise<PasswordResetRequestResult> {
    const account = await this.accounts.findByEmail(email.trim().toLowerCase());
    if (!account) return { resetUrl: null };

    const token = PasswordResetToken.issue(randomUUID(), account.accountId(), randomBytes(24).toString('hex'));
    await this.tokens.save(token);

    const resetUrl = `${baseUrl.replace(/\/$/, '')}/recuperar/${token.tokenValue()}`;
    await this.notifier.sendResetLink({
      userId: account.accountId(),
      email: account.accountEmail(),
      fullName: '',
      resetUrl,
    });
    return { resetUrl };
  }
}
