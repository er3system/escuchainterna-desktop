import { generateSecret, generateURI, verifySync } from 'otplib';

/**
 * TOTP (verificación en dos pasos) sobre otplib v13.
 * Módulo compartido entre /configuracion/seguridad (alta/baja del 2FA)
 * y /login/verificacion (paso intermedio tras la contraseña).
 */

const ISSUER = 'EscuchaInterna';

/** Secreto Base32 nuevo (compatible con Google Authenticator, Authy, 1Password…). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** URI otpauth:// para el código QR del enrolamiento. */
export function totpKeyUri(accountEmail: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountEmail, secret });
}

/**
 * Verifica un código de 6 dígitos contra el secreto, con tolerancia de un
 * periodo (±30 s) para absorber desfases de reloj del teléfono.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const token = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return verifySync({ secret, token, epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}
