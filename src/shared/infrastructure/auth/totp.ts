import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { decryptField, encryptField } from '../crypto/FieldEncryption';

/**
 * TOTP opt-in (v3 §1.3): segundo factor con app de autenticación.
 *
 * - El secreto se guarda CIFRADO (FieldEncryption) en `users.totp_secret`.
 * - `totp_enabled = 0` con secreto presente significa "configuración pendiente"
 *   (aún no confirmada con un código válido); el login solo exige TOTP cuando
 *   `totp_enabled = 1`.
 */

const ISSUER = 'EscuchaInterna';
/** Tolerancia de reloj: ±30 s (un periodo) como recomienda el RFC 6238. */
const EPOCH_TOLERANCE = 30;

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

interface UserTotpRow {
  email: string;
  totp_secret: string | null;
  totp_enabled: number;
}

async function userTotpRow(userId: string): Promise<UserTotpRow | null> {
  return getDatabaseAdapter().queryRow<UserTotpRow>(
    'SELECT email, totp_secret, totp_enabled FROM users WHERE id = ?',
    [userId],
  );
}

export async function totpEnabled(userId: string): Promise<boolean> {
  return ((await userTotpRow(userId))?.totp_enabled ?? 0) === 1;
}

/**
 * Inicia la activación: genera secreto nuevo (pendiente de confirmar), lo
 * guarda cifrado y devuelve QR + código manual para la app de autenticación.
 */
export async function beginTotpSetup(userId: string): Promise<TotpSetup | null> {
  const row = await userTotpRow(userId);
  if (!row) return null;

  const secret = generateSecret();
  await getDatabaseAdapter().execute(
    'UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?',
    [encryptField(secret), userId],
  );

  const otpauthUrl = generateURI({ issuer: ISSUER, label: row.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  return { secret, otpauthUrl, qrDataUrl };
}

/** Verifica un código contra el secreto guardado (pendiente o activo). */
export async function verifyUserTotp(userId: string, token: string): Promise<boolean> {
  const row = await userTotpRow(userId);
  if (!row?.totp_secret) return false;
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    const result = await verify({
      secret: decryptField(row.totp_secret),
      token: clean,
      epochTolerance: EPOCH_TOLERANCE,
    });
    return result.valid;
  } catch {
    return false;
  }
}

/** Confirma la activación con un código válido → totp_enabled = 1. */
export async function confirmTotpSetup(userId: string, token: string): Promise<boolean> {
  const ok = await verifyUserTotp(userId, token);
  if (!ok) return false;
  await getDatabaseAdapter().execute('UPDATE users SET totp_enabled = 1 WHERE id = ?', [userId]);
  return true;
}

/** Desactiva el 2FA; exige un código válido para evitar desactivaciones ajenas. */
export async function disableTotp(userId: string, token: string): Promise<boolean> {
  const ok = await verifyUserTotp(userId, token);
  if (!ok) return false;
  await getDatabaseAdapter().execute(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?',
    [userId],
  );
  return true;
}

/**
 * Reset ADMINISTRATIVO del 2FA (sin token): para cuando el usuario pierde su
 * autenticador y no hay forma de aportar un código válido. Solo debe invocarse
 * desde un caso de uso de /admin (gateado por requireAdmin) y queda auditado allí.
 */
export async function forceDisableTotp(userId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?',
    [userId],
  );
}
