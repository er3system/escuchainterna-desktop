import { describe, it, expect } from 'vitest';
import { EmailVerificationToken } from '@/contexts/identity/domain/EmailVerificationToken';
import { VerifyEmail } from '@/contexts/identity/application/verify-email/VerifyEmail';
import { RequestEmailVerification } from '@/contexts/identity/application/request-email-verification/RequestEmailVerification';
import { UserAccount } from '@/contexts/identity/domain/UserAccount';
import type { UserAccountRepository } from '@/contexts/identity/domain/repositories/UserAccountRepository';
import type { EmailVerificationTokenRepository } from '@/contexts/identity/domain/repositories/EmailVerificationTokenRepository';
import type {
  EmailVerificationNotification,
  EmailVerificationNotifier,
} from '@/contexts/identity/domain/EmailVerificationNotifier';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

class InMemoryAccounts implements UserAccountRepository {
  private accounts = new Map<string, UserAccount>();
  public readonly verified: string[] = [];

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

  public async markEmailVerified(userId: string): Promise<void> {
    this.verified.push(userId);
  }

  public async recordTermsAcceptance(): Promise<void> {
    /* no aplica a estos tests */
  }
}

class InMemoryTokens implements EmailVerificationTokenRepository {
  private tokens = new Map<string, EmailVerificationToken>();

  public async save(token: EmailVerificationToken): Promise<void> {
    this.tokens.set(token.tokenValue(), token);
  }

  public async findByToken(token: string): Promise<EmailVerificationToken | null> {
    return this.tokens.get(token) ?? null;
  }
}

class FakeNotifier implements EmailVerificationNotifier {
  public readonly sent: EmailVerificationNotification[] = [];

  public async sendVerificationLink(notification: EmailVerificationNotification): Promise<void> {
    this.sent.push(notification);
  }
}

describe('EmailVerificationToken', () => {
  const issuedAt = new Date('2026-06-01T10:00:00.000Z');

  it('es válido dentro de los 7 días siguientes a su emisión', () => {
    const token = EmailVerificationToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    expect(token.isValid(new Date(issuedAt.getTime() + 6 * DAY_MS))).toBe(true);
  });

  it('expira pasados los 7 días', () => {
    const token = EmailVerificationToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    expect(token.isValid(new Date(issuedAt.getTime() + SEVEN_DAYS_MS + 1))).toBe(false);
  });

  it('es de un solo uso: tras consumirse deja de ser válido', () => {
    const token = EmailVerificationToken.issue('id-1', 'user-1', 'abc123', issuedAt);
    token.consume();
    expect(token.isValid(issuedAt)).toBe(false);
  });
});

describe('VerifyEmail (caso de uso)', () => {
  async function setup() {
    const accounts = new InMemoryAccounts();
    const tokens = new InMemoryTokens();
    await accounts.save(UserAccount.registerPublic('user-1', 'psicologa@demo.test', 'hash'));
    return { accounts, tokens, useCase: new VerifyEmail(accounts, tokens) };
  }

  it('con un token válido marca el correo verificado y consume el token', async () => {
    const { accounts, tokens, useCase } = await setup();
    await tokens.save(EmailVerificationToken.issue('id-1', 'user-1', 'token-valido'));

    const result = await useCase.verify('token-valido');

    expect(result.ok).toBe(true);
    expect(accounts.verified).toContain('user-1');
    // El token quedó consumido: un segundo uso ya no verifica.
    expect((await useCase.verify('token-valido')).ok).toBe(false);
  });

  it('rechaza tokens inexistentes (ok:false, sin lanzar)', async () => {
    const { useCase } = await setup();
    expect((await useCase.verify('no-existe')).ok).toBe(false);
  });

  it('rechaza tokens vencidos (ok:false)', async () => {
    const { tokens, useCase } = await setup();
    const old = new Date(Date.now() - (SEVEN_DAYS_MS + DAY_MS));
    await tokens.save(EmailVerificationToken.issue('id-1', 'user-1', 'token-viejo', old));
    expect((await useCase.verify('token-viejo')).ok).toBe(false);
  });
});

describe('RequestEmailVerification (caso de uso)', () => {
  async function setup() {
    const accounts = new InMemoryAccounts();
    const tokens = new InMemoryTokens();
    const notifier = new FakeNotifier();
    await accounts.save(UserAccount.registerPublic('user-1', 'psicologa@demo.test', 'hash'));
    return {
      accounts,
      tokens,
      notifier,
      useCase: new RequestEmailVerification(accounts, tokens, notifier),
    };
  }

  it('genera un token persistido e invoca al notifier con el enlace', async () => {
    const { tokens, notifier, useCase } = await setup();

    const { verifyUrl } = await useCase.request('user-1', 'https://app.test');

    expect(verifyUrl).toMatch(/^https:\/\/app\.test\/verificar\//);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].userId).toBe('user-1');
    expect(notifier.sent[0].email).toBe('psicologa@demo.test');
    expect(notifier.sent[0].verifyUrl).toBe(verifyUrl);
    // El token del enlace quedó guardado y es válido.
    const tokenValue = verifyUrl!.split('/').pop()!;
    expect((await tokens.findByToken(tokenValue))?.isValid()).toBe(true);
  });

  it('si el usuario no existe no envía nada (verifyUrl null)', async () => {
    const { notifier, useCase } = await setup();
    const { verifyUrl } = await useCase.request('no-existe', 'https://app.test');
    expect(verifyUrl).toBeNull();
    expect(notifier.sent).toHaveLength(0);
  });
});
