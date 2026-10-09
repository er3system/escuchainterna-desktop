import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readRequiredSecret } from '../config/runtime';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

const COOKIE_NAME = 'escuchainterna_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Epoch de sesión del usuario (SEG-4). Se embebe en el token y se compara en cada
 * lectura: si el usuario rotó su epoch (al restablecer/cambiar contraseña), las cookies
 * viejas dejan de validar. Devuelve -1 si el usuario no existe (ninguna cookie coincide).
 *
 * SOLO runtime Node: usa el adaptador de BD (node:sqlite). getSessionUserId/createSession NO deben
 * llamarse desde el middleware ni en edge (allí node:sqlite no existe). Hoy el middleware
 * solo setea x-pathname; si en el futuro la verificación de sesión se mueve al middleware,
 * habrá que mover el chequeo de epoch a un runtime Node (route handler / layout).
 */
async function currentSessionEpoch(userId: string): Promise<number> {
  const row = await getDatabaseAdapter().queryRow<{ session_epoch: number }>(
    'SELECT session_epoch FROM users WHERE id = ?',
    [userId],
  );
  return row ? Number(row.session_epoch) : -1;
}

/** Incrementa el epoch del usuario → invalida TODAS sus sesiones vigentes. */
export async function bumpSessionEpoch(userId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    'UPDATE users SET session_epoch = session_epoch + 1 WHERE id = ?',
    [userId],
  );
}

/**
 * Secreto de firma de cookies, perezoso: en producción es obligatorio (fail-hard si
 * falta o es débil); en dev cae a un valor de desarrollo con aviso. Perezoso para no
 * romper `next build` (solo se evalúa cuando se firma/verifica una sesión real).
 */
let cachedSessionSecret: string | null = null;
function sessionSecret(): string {
  if (cachedSessionSecret === null) {
    cachedSessionSecret = readRequiredSecret('SESSION_SECRET', 'escuchainterna-local-dev-secret', 16);
  }
  return cachedSessionSecret;
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('hex');
}

export async function createSession(userId: string, remember = true): Promise<void> {
  const payload = `${userId}.${await currentSessionEpoch(userId)}.${Date.now()}`;
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: SESSION_TTL_SECONDS } : {}),
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (sign(payload) !== signature) return null;
  // Formato: `userId.epoch.timestamp`. El epoch del token debe coincidir con el del
  // usuario (SEG-4): tras un reset de contraseña deja de coincidir → cookie inválida.
  // Las cookies del formato anterior (sin epoch) ya no validan y obligan a re-login.
  const parts = payload.split('.');
  const createdAt = Number(parts[2]);
  if (parts.length !== 3 || !Number.isFinite(createdAt) || createdAt > Date.now() || Date.now() - createdAt > SESSION_TTL_SECONDS * 1000) return null;
  const userId = parts[0] ?? null;
  if (!userId) return null;
  const tokenEpoch = Number(parts[1]);
  if (!Number.isFinite(tokenEpoch) || tokenEpoch !== (await currentSessionEpoch(userId))) return null;
  return userId;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Igual que getSessionUserId pero garantiza sesión: si no hay usuario
 * autenticado redirige a /login. Úsalo en pages/actions privadas para obtener
 * el owner_user_id con el que se filtran TODOS los datos operativos.
 */
export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  return userId;
}

// ===================== Impersonación ("ver como usuario", soporte de admin) =====================

const IMPERSONATOR_COOKIE_NAME = 'escuchainterna_impersonator';
/** La sesión impersonada caduca sola en 1 hora (ventana de soporte acotada). */
const IMPERSONATION_TTL_SECONDS = 60 * 60;

/**
 * Inicia una sesión impersonada: la cookie de sesión principal pasa a ser el
 * usuario objetivo (la app se comporta como él), y una cookie FIRMADA aparte
 * guarda el id del admin real, para poder volver y para mostrar el banner.
 * Solo debe invocarse desde una acción gateada por requireAdmin.
 */
export async function startImpersonation(targetUserId: string, impersonatorUserId: string): Promise<void> {
  await createSession(targetUserId);
  const payload = `${impersonatorUserId}.${Date.now()}`;
  const store = await cookies();
  store.set(IMPERSONATOR_COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: IMPERSONATION_TTL_SECONDS,
  });
}

/** Id del admin real detrás de una sesión impersonada; null si no se está impersonando. */
export async function getImpersonatorUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(IMPERSONATOR_COOKIE_NAME)?.value;
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (sign(payload) !== signature) return null;
  return payload.split('.')[0] ?? null;
}

/**
 * Termina la impersonación: restaura la sesión del admin real (leído de la
 * cookie firmada) y borra la cookie de impersonación. Devuelve el id del admin
 * restaurado, o null si no había impersonación activa.
 */
export async function stopImpersonation(): Promise<string | null> {
  const adminUserId = await getImpersonatorUserId();
  const store = await cookies();
  store.delete(IMPERSONATOR_COOKIE_NAME);
  if (adminUserId) await createSession(adminUserId);
  return adminUserId;
}

// ===================== Reto TOTP (paso intermedio del login, v3 §1.3) =====================

const TOTP_COOKIE_NAME = 'escuchainterna_totp';
const TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Tras validar la contraseña de un usuario CON 2FA activo, se emite esta
 * cookie temporal firmada (5 min) y se redirige a /login/totp. La sesión real
 * solo se crea cuando el código TOTP es válido.
 */
export async function createTotpChallenge(userId: string, remember = false): Promise<void> {
  const expiresAt = Date.now() + TOTP_CHALLENGE_TTL_MS;
  const payload = `${userId}.${expiresAt}.${remember ? '1' : '0'}`;
  const store = await cookies();
  store.set(TOTP_COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TOTP_CHALLENGE_TTL_MS / 1000),
  });
}

/** Lee el reto TOTP vigente; null si no existe, está alterado o expiró. */
async function readTotpChallengeDetails(): Promise<{ userId: string; remember: boolean } | null> {
  const store = await cookies();
  const token = store.get(TOTP_COOKIE_NAME)?.value;
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (sign(payload) !== signature) return null;

  const [userId, expiry, remember, extra] = payload.split('.');
  if (extra !== undefined || (remember !== undefined && remember !== '0' && remember !== '1')) return null;
  const expiresAt = Number(expiry);
  if (!userId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { userId, remember: remember === '1' };
}

export async function readTotpChallenge(): Promise<string | null> {
  return (await readTotpChallengeDetails())?.userId ?? null;
}

export async function readTotpRememberAccount(): Promise<boolean> {
  return (await readTotpChallengeDetails())?.remember ?? false;
}

export async function clearTotpChallenge(): Promise<void> {
  const store = await cookies();
  store.delete(TOTP_COOKIE_NAME);
}
