import type { EmailVerificationTokenRepository } from '../../domain/repositories/EmailVerificationTokenRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

export interface VerifyEmailResult {
  ok: boolean;
}

/**
 * Confirma el correo a partir del token del enlace (7 días, un solo uso).
 * Si el token no existe o ya no es válido (vencido o ya usado) devuelve ok:false
 * y el banner permite reenviar. No lanza: la verificación nunca es bloqueante.
 */
export class VerifyEmail {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly tokens: EmailVerificationTokenRepository,
  ) {}

  public async verify(tokenValue: string): Promise<VerifyEmailResult> {
    const token = await this.tokens.findByToken(tokenValue.trim());
    if (!token || !token.isValid()) return { ok: false };

    await this.accounts.markEmailVerified(token.tokenOwnerUserId());
    token.consume();
    await this.tokens.save(token);
    return { ok: true };
  }
}
