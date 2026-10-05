import type { UserRole } from '../../domain/value-objects/UserRole';
import { InvalidCredentialsError } from '../../domain/errors/InvalidCredentialsError';
import { AccountSuspendedError } from '../../domain/errors/AccountSuspendedError';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

export interface LoginResult {
  userId: string;
  role: UserRole;
}

/** Login v2: valida credenciales y estado; el redirect por rol lo decide la action. */
export class LoginUser {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  public async login(email: string, password: string): Promise<LoginResult> {
    const account = await this.accounts.findByEmail(email.trim().toLowerCase());
    if (!account) throw new InvalidCredentialsError();
    if (!this.hasher.verify(password, account.storedPasswordHash())) {
      throw new InvalidCredentialsError();
    }
    if (account.isSuspended()) throw new AccountSuspendedError();
    return { userId: account.accountId(), role: account.accountRole() };
  }
}
