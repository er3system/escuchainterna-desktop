import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ values: new Map<string, string>(), options: new Map<string, Record<string, unknown>>(), epoch: 1 }));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => harness.values.has(name) ? { value: harness.values.get(name) } : undefined,
  set: (name: string, value: string, options: Record<string, unknown>) => { harness.values.set(name, value); harness.options.set(name, options); },
  delete: (name: string) => { harness.values.delete(name); harness.options.delete(name); },
}) }));
vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({ getDatabaseAdapter: () => ({ queryRow: async () => ({ session_epoch: harness.epoch }) }) }));
import { createSession, getSessionUserId, createTotpChallenge, readTotpChallenge, readTotpRememberAccount } from '@/shared/infrastructure/auth/session';
import { readRememberedAccount, rememberAccount } from '@/shared/infrastructure/auth/rememberedAccount';

describe('recordar cuenta y duración de sesión', () => {
  beforeEach(() => { harness.values.clear(); harness.options.clear(); harness.epoch = 1; vi.stubEnv('SESSION_SECRET', 'synthetic-session-secret-for-tests'); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('guarda únicamente el correo en una cookie HttpOnly y permite olvidarlo', async () => {
    await rememberAccount('persona@example.test', true);
    expect(await readRememberedAccount()).toBe('persona@example.test');
    expect(harness.options.get('escuchainterna_account')).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
    expect([...harness.values.values()]).toEqual(['persona@example.test']);
    await rememberAccount('persona@example.test', false);
    expect(await readRememberedAccount()).toBe('');
  });

  it('solo hace persistente la sesión cuando se pide recordar la cuenta', async () => {
    await createSession('user-local', false);
    expect(harness.options.get('escuchainterna_session')).not.toHaveProperty('maxAge');
    expect(await getSessionUserId()).toBe('user-local');
    await createSession('user-local', true);
    expect(harness.options.get('escuchainterna_session')?.maxAge).toBe(2592000);
    harness.epoch += 1;
    expect(await getSessionUserId()).toBeNull();
  });

  it('rechaza una sesión vencida aunque se vuelva a presentar su cookie firmada', async () => {
    vi.useFakeTimers();
    await createSession('user-local', true);
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    expect(await getSessionUserId()).toBeNull();
  });

  it.each([true, false])('conserva la elección %s durante el segundo factor y rechaza la alteración', async remember => {
    await createTotpChallenge('user-local', remember);
    expect(await readTotpChallenge()).toBe('user-local');
    expect(await readTotpRememberAccount()).toBe(remember);
    const token = harness.values.get('escuchainterna_totp')!;
    harness.values.set('escuchainterna_totp', `${token.slice(0, -1)}x`);
    expect(await readTotpChallenge()).toBeNull();
    expect(await readTotpRememberAccount()).toBe(false);
  });
});
