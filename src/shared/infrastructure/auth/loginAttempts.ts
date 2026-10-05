import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Endurecimiento de login (v3 §1.3): tras 5 intentos fallidos por correo, la
 * cuenta queda bloqueada 15 minutos (`login_attempts.locked_until`). El
 * contador aplica también a correos que NO existen, para no revelar si una
 * cuenta está registrada. Un login exitoso limpia el contador.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export interface LockStatus {
  locked: boolean;
  /** Minutos restantes de bloqueo (redondeado hacia arriba); 0 si no hay bloqueo. */
  minutesLeft: number;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

interface AttemptRow {
  failed_count: number;
  locked_until: string | null;
}

/** ¿Está bloqueado este correo ahora mismo? */
export async function lockStatus(email: string): Promise<LockStatus> {
  const row = await getDatabaseAdapter().queryRow<AttemptRow>(
    'SELECT failed_count, locked_until FROM login_attempts WHERE email = ?',
    [normalize(email)],
  );
  if (!row?.locked_until) return { locked: false, minutesLeft: 0 };

  const until = new Date(row.locked_until).getTime();
  const remaining = until - Date.now();
  if (remaining <= 0) return { locked: false, minutesLeft: 0 };
  return { locked: true, minutesLeft: Math.ceil(remaining / 60_000) };
}

/**
 * Registra un intento fallido. Si el bloqueo anterior ya venció, el contador
 * vuelve a empezar. Devuelve el estado de bloqueo resultante.
 */
export async function registerFailedAttempt(email: string): Promise<LockStatus> {
  const db = getDatabaseAdapter();
  const key = normalize(email);
  const now = new Date();

  const row = await db.queryRow<AttemptRow>(
    'SELECT failed_count, locked_until FROM login_attempts WHERE email = ?',
    [key],
  );

  let failed = row?.failed_count ?? 0;
  if (row?.locked_until && new Date(row.locked_until).getTime() <= now.getTime()) {
    failed = 0; // bloqueo vencido: ciclo nuevo
  }
  failed += 1;

  const lockedUntil =
    failed >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString()
      : (row?.locked_until && new Date(row.locked_until).getTime() > now.getTime()
          ? row.locked_until
          : null);

  await db.execute(
    `INSERT INTO login_attempts (email, failed_count, locked_until, last_attempt_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       failed_count = excluded.failed_count,
       locked_until = excluded.locked_until,
       last_attempt_at = excluded.last_attempt_at`,
    [key, failed, lockedUntil, now.toISOString()],
  );

  return lockedUntil
    ? { locked: true, minutesLeft: LOCK_MINUTES }
    : { locked: false, minutesLeft: 0 };
}

/** Intento exitoso: limpia el contador del correo. */
export async function clearLoginAttempts(email: string): Promise<void> {
  await getDatabaseAdapter().execute('DELETE FROM login_attempts WHERE email = ?', [normalize(email)]);
}
