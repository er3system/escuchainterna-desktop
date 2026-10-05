import { assertStrongPassword } from '../../domain/value-objects/passwordPolicy';
import { IncorrectPasswordError } from '../../domain/errors/IncorrectPasswordError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

/**
 * Cambia la contraseña del usuario YA autenticado (autoservicio): verifica la contraseña
 * actual y exige la política a la nueva. Devuelve el id del usuario para que el llamador
 * invalide las DEMÁS sesiones (SEG-4: bump de epoch) tras el cambio.
 */
export class ChangePassword {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  public async change(userId: string, currentPassword: string, newPassword: string): Promise<string> {
    const account = await this.accounts.findById(userId);
    if (!account || !this.hasher.verify(currentPassword, account.storedPasswordHash())) {
      throw new IncorrectPasswordError();
    }
    assertStrongPassword(newPassword);
    account.changePassword(this.hasher.hash(newPassword));
    await this.accounts.save(account);
    return account.accountId();
  }
}
