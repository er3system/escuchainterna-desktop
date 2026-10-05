import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../domain/PasswordHasher';

/**
 * Hash scrypt `salt:hash` — mismo formato que el del módulo de sesión
 * compartido, pero sin dependencias de Next (usable en seed y tests).
 */
export class ScryptPasswordHasher implements PasswordHasher {
  public hash(plain: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(plain, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  public verify(plain: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(plain, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}
