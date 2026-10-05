import { InvalidPasswordResetTokenError } from '../../domain/errors/InvalidPasswordResetTokenError';
import { assertStrongPassword } from '../../domain/value-objects/passwordPolicy';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { PasswordResetTokenRepository } from '../../domain/repositories/PasswordResetTokenRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

/** Cambia la contraseña con un token vigente (1 h, un solo uso). */
export class ResetPassword {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly tokens: PasswordResetTokenRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Devuelve el id del usuario cuya contraseña se cambió (para invalidar sus sesiones). */
  public async reset(tokenValue: string, newPassword: string): Promise<string> {
    const token = await this.tokens.findByToken(tokenValue.trim());
    if (!token || !token.isValid()) throw new InvalidPasswordResetTokenError();
    assertStrongPassword(newPassword);

    const account = await this.accounts.findById(token.tokenOwnerUserId());
    if (!account) throw new InvalidPasswordResetTokenError();

    account.changePassword(this.hasher.hash(newPassword));
    await this.accounts.save(account);
    token.consume();
    await this.tokens.save(token);
    return account.accountId();
  }
}
