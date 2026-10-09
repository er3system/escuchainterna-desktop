import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { consumeDesktopRecoveryProof } from '@/shared/infrastructure/auth/desktopAccountRecovery';

const origin = 'http://127.0.0.1:51234';
const host = new URL(origin).host;
const email = 'propietaria@example.test';
const secret = 'synthetic-desktop-secret-only-for-tests';
function proof(overrides: Record<string, unknown> = {}, signingSecret = secret): string {
  const encoded = Buffer.from(JSON.stringify({ email, origin, issuedAt: Date.now(), nonce: randomUUID(), ...overrides })).toString('base64url');
  return `${encoded}.${createHmac('sha256', signingSecret).update(`desktop-account-recovery:${encoded}`).digest('base64url')}`;
}

describe('recuperación limitada al proceso nativo', () => {
  beforeEach(() => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    vi.stubEnv('APP_URL', origin);
    vi.stubEnv('SESSION_SECRET', secret);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('acepta una prueba una sola vez y la vincula al correo y origen', () => {
    const token = proof();
    expect(consumeDesktopRecoveryProof(token, 'otra@example.test', host)).toBe(false);
    expect(consumeDesktopRecoveryProof(token, email, '127.0.0.1:51235')).toBe(false);
    expect(consumeDesktopRecoveryProof(token, email, 'localhost:51234')).toBe(false);
    expect(consumeDesktopRecoveryProof(token, email, host)).toBe(true);
    expect(consumeDesktopRecoveryProof(token, email, host)).toBe(false);
  });

  it('rechaza pruebas sin firma, alteradas, vencidas, futuras o mal formadas', () => {
    for (const token of [null, '', 'invalida', proof({}, 'otro-secreto'), proof({ issuedAt: Date.now() - 31_000 }), proof({ issuedAt: Date.now() + 60_000 }), proof({ nonce: '' }), `${proof()}.extra`]) {
      expect(consumeDesktopRecoveryProof(token, email, host)).toBe(false);
    }
  });

  it('permanece cerrada en la edición web y fuera del loopback', () => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '0');
    expect(consumeDesktopRecoveryProof(proof(), email, host)).toBe(false);
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    vi.stubEnv('APP_URL', 'https://escuchainterna.example.test');
    expect(consumeDesktopRecoveryProof(proof({ origin: process.env.APP_URL }), email, 'escuchainterna.example.test')).toBe(false);
  });
});
