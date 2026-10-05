import { describe, it, expect } from 'vitest';
import { LoginUser } from '@/contexts/identity/application/login-user/LoginUser';
import { UserAccount } from '@/contexts/identity/domain/UserAccount';
import { InvalidCredentialsError } from '@/contexts/identity/domain/errors/InvalidCredentialsError';
import { AccountSuspendedError } from '@/contexts/identity/domain/errors/AccountSuspendedError';
import type { UserAccountRepository } from '@/contexts/identity/domain/repositories/UserAccountRepository';
import type { PasswordHasher } from '@/contexts/identity/domain/PasswordHasher';

class InMemoryAccounts implements UserAccountRepository {
  private accounts = new Map<string, UserAccount>();

  public async save(account: UserAccount): Promise<void> {
    this.accounts.set(account.accountId(), account);
  }

  public async findByEmail(email: string): Promise<UserAccount | null> {
    for (const account of this.accounts.values()) {
      if (account.accountEmail() === email) return account;
    }
    return null;
  }

  public async findById(id: string): Promise<UserAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  public async markEmailVerified(): Promise<void> {
    /* no aplica a estos tests */
  }

  public async recordTermsAcceptance(): Promise<void> {
    /* no aplica a estos tests */
  }
}

class FakeHasher implements PasswordHasher {
  public hash(plain: string): string {
    return `hashed:${plain}`;
  }

  public verify(plain: string, storedHash: string): boolean {
    return storedHash === `hashed:${plain}`;
  }
}

describe('LoginUser (caso de uso)', () => {
  async function setup() {
    const accounts = new InMemoryAccounts();
    const hasher = new FakeHasher();
    // El correo se normaliza en el alta; la cuenta queda como 'psicologa@demo.test'.
    const account = UserAccount.registerPublic('user-1', 'psicologa@demo.test', hasher.hash('clave-correcta'));
    await accounts.save(account);
    return { accounts, hasher, useCase: new LoginUser(accounts, hasher) };
  }

  it('correo + contraseña correctos devuelve { userId, role }', async () => {
    const { useCase } = await setup();
    const result = await useCase.login('psicologa@demo.test', 'clave-correcta');
    expect(result).toEqual({ userId: 'user-1', role: 'psychologist' });
  });

  it('contraseña incorrecta lanza InvalidCredentialsError', async () => {
    const { useCase } = await setup();
    await expect(useCase.login('psicologa@demo.test', 'clave-erronea')).rejects.toThrow(InvalidCredentialsError);
  });

  it('correo inexistente lanza InvalidCredentialsError (no revela existencia)', async () => {
    const { useCase } = await setup();
    await expect(useCase.login('nadie@demo.test', 'clave-correcta')).rejects.toThrow(InvalidCredentialsError);
  });

  it('correo con mayúsculas y espacios resuelve la misma cuenta (trim + lowercase)', async () => {
    const { useCase } = await setup();
    const result = await useCase.login('  PSICOLOGA@Demo.Test  ', 'clave-correcta');
    expect(result).toEqual({ userId: 'user-1', role: 'psychologist' });
  });

  it('cuenta suspendida lanza AccountSuspendedError aunque la contraseña sea correcta', async () => {
    const { accounts, useCase } = await setup();
    const account = await accounts.findById('user-1');
    account!.suspend();
    await accounts.save(account!);
    await expect(useCase.login('psicologa@demo.test', 'clave-correcta')).rejects.toThrow(AccountSuspendedError);
  });

  it('el estado se evalúa TRAS validar credenciales: cuenta suspendida + contraseña mala da InvalidCredentialsError', async () => {
    const { accounts, useCase } = await setup();
    const account = await accounts.findById('user-1');
    account!.suspend();
    await accounts.save(account!);
    await expect(useCase.login('psicologa@demo.test', 'clave-erronea')).rejects.toThrow(InvalidCredentialsError);
  });
});
