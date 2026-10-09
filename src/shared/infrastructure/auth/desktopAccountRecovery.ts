import { createHmac, timingSafeEqual } from 'node:crypto';
import { isDesktopEdition } from '../config/desktopEdition';

const WINDOW_MS = 30_000;
const consumed = new Map<string, number>();

/** Prueba de un solo uso creada por el proceso principal, nunca por el navegador. */
export function consumeDesktopRecoveryProof(proof: string | null, email: string, receivedHost: string | null): boolean {
  if (!isDesktopEdition() || !proof || proof.length > 2048 || !process.env.SESSION_SECRET) return false;
  try {
    // Next normaliza Request.url a localhost; el Host recibido conserva el origen real.
    const origin = process.env.APP_URL ?? '';
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || receivedHost !== new URL(origin).host) return false;
    const [encoded, signature, extra] = proof.split('.');
    if (!encoded || !signature || extra !== undefined) return false;
    const expected = createHmac('sha256', process.env.SESSION_SECRET).update(`desktop-account-recovery:${encoded}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return false;
    const value: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || !('email' in value) || !('origin' in value) || !('issuedAt' in value) || !('nonce' in value)) return false;
    const now = Date.now();
    if (value.email !== email || value.origin !== origin || typeof value.issuedAt !== 'number' || !Number.isFinite(value.issuedAt)
      || value.issuedAt > now || now - value.issuedAt > WINDOW_MS || typeof value.nonce !== 'string'
      || !/^[a-f0-9-]{36}$/.test(value.nonce)) return false;
    for (const [nonce, expires] of consumed) if (expires < now) consumed.delete(nonce);
    if (consumed.has(value.nonce) || consumed.size >= 1000) return false;
    consumed.set(value.nonce, value.issuedAt + WINDOW_MS);
    return true;
  } catch { return false; }
}
