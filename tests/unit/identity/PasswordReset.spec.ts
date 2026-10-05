import { describe, it, expect } from 'vitest';
import { PasswordResetToken } from '@/contexts/identity/domain/PasswordResetToken';
import { ResetPassword } from '@/contexts/identity/application/reset-password/ResetPassword';
import { UserAccount } from '@/contexts/identity/domain/UserAccount';
import { InvalidPasswordResetTokenError } from '@/contexts/identity/domain/errors/InvalidPasswordResetTokenError';
import { WeakPasswordError } from '@/contexts/identity/domain/errors/WeakPasswordError';
import type { UserAccountRepository } from '@/contexts/identity/domain/repositories/UserAccountRepository';
import type { PasswordResetTokenRepository } from '@/contexts/identity/domain/repositories/PasswordResetTokenRepository';
import type { PasswordHasher } from '@/contexts/identity/domain/PasswordHasher';

const HOUR_MS = 60 * 60 * 1000;

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

class InMemoryTokens implements PasswordResetTokenRepository {
  private tokens = new Map<string, PasswordResetToken>();

  public async save(token: PasswordResetToken): Promise<void> {
    this.tokens.set(token.tokenValue(), token);
  }

  public async findByToken(token: string): Promise<PasswordResetToken | null> {
    return this.tokens.get(token) ?? null;
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

describe('PasswordResetToken', () => {
  const issuedAt = new Date('2026-06-01T10:00:00.000Z');

  it('es válido dentro de la hora siguiente a su emisión', () => {
    const token = PasswordResetToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    expect(token.isValid(new Date(issuedAt.getTime() + 59 * 60 * 1000))).toBe(true);
  });

  it('expira pasada 1 hora', () => {
    const token = PasswordResetToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    expect(token.isValid(new Date(issuedAt.getTime() + HOUR_MS + 1))).toBe(false);
  });

  it('es de un solo uso: tras consumirse deja de ser válido', () => {
    const token = PasswordResetToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    token.consume();
    expect(token.isValid(issuedAt)).toBe(false);
  });
});

describe('ResetPassword (caso de uso)', () => {
  async function setup() {
    const accounts = new InMemoryAccounts();
    const tokens = new InMemoryTokens();
    const hasher = new FakeHasher();
    const account = UserAccount.registerPublic('user-1', 'psicologa@demo.test', hasher.hash('anterior1'));
    await accounts.save(account);
    return { accounts, tokens, hasher, useCase: new ResetPassword(accounts, tokens, hasher) };
  }

  it('cambia la contraseña con un token vigente y lo consume', async () => {
    const { accounts, tokens, hasher, useCase } = await setup();
    await tokens.save(PasswordResetToken.issue('id-1', 'user-1', 'token-valido'));

    await useCase.reset('token-valido', 'nuevaclave9');

    const account = await accounts.findById('user-1');
    expect(hasher.verify('nuevaclave9', account!.storedPasswordHash())).toBe(true);
    // El token quedó consumido: un segundo uso falla.
    await expect(useCase.reset('token-valido', 'otraclave9')).rejects.toThrow(InvalidPasswordResetTokenError);
  });

  it('rechaza tokens inexistentes', async () => {
    const { useCase } = await setup();
    await expect(useCase.reset('no-existe', 'nuevaclave')).rejects.toThrow(InvalidPasswordResetTokenError);
  });

  it('rechaza contraseñas débiles (política mínima)', async () => {
    const { tokens, useCase } = await setup();
    await tokens.save(PasswordResetToken.issue('id-1', 'user-1', 'token-valido'));
    await expect(useCase.reset('token-valido', '123')).rejects.toThrow(WeakPasswordError);
    // Suficientemente larga pero sin número: también se rechaza.
    await expect(useCase.reset('token-valido', 'sololetras')).rejects.toThrow(WeakPasswordError);
  });
});
