import { describe, it, expect } from 'vitest';
import { ChangePassword } from '@/contexts/identity/application/change-password/ChangePassword';
import { UserAccount } from '@/contexts/identity/domain/UserAccount';
import { IncorrectPasswordError } from '@/contexts/identity/domain/errors/IncorrectPasswordError';
import { WeakPasswordError } from '@/contexts/identity/domain/errors/WeakPasswordError';
import type { UserAccountRepository } from '@/contexts/identity/domain/repositories/UserAccountRepository';
import type { PasswordHasher } from '@/contexts/identity/domain/PasswordHasher';

class InMemoryAccounts implements UserAccountRepository {
  private readonly accounts = new Map<string, UserAccount>();
  public async save(account: UserAccount): Promise<void> {
    this.accounts.set(account.accountId(), account);
  }
  public async findByEmail(): Promise<UserAccount | null> {
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

describe('ChangePassword (autoservicio)', () => {
  async function setup() {
    const accounts = new InMemoryAccounts();
    const hasher = new FakeHasher();
    await accounts.save(UserAccount.registerPublic('u1', 'a@demo.test', hasher.hash('actualSegura1')));
    return { accounts, hasher, useCase: new ChangePassword(accounts, hasher) };
  }

  it('cambia la contraseña verificando la actual', async () => {
    const { accounts, hasher, useCase } = await setup();
    const id = await useCase.change('u1', 'actualSegura1', 'nuevaSegura9');
    expect(id).toBe('u1');
    expect(hasher.verify('nuevaSegura9', (await accounts.findById('u1'))!.storedPasswordHash())).toBe(true);
  });

  it('rechaza si la contraseña actual es incorrecta', async () => {
    const { useCase } = await setup();
    await expect(useCase.change('u1', 'incorrecta', 'nuevaSegura9')).rejects.toThrow(IncorrectPasswordError);
  });

  it('aplica la política a la nueva contraseña', async () => {
    const { useCase } = await setup();
    await expect(useCase.change('u1', 'actualSegura1', '123')).rejects.toThrow(WeakPasswordError);
    await expect(useCase.change('u1', 'actualSegura1', 'sololetras')).rejects.toThrow(WeakPasswordError);
  });

  it('usuario inexistente → IncorrectPasswordError (no revela existencia)', async () => {
    const { useCase } = await setup();
    await expect(useCase.change('no-existe', 'x', 'nuevaSegura9')).rejects.toThrow(IncorrectPasswordError);
  });
});
