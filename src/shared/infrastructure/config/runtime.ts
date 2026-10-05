/**
 * Helpers de entorno y secretos del servidor. Centralizan la diferencia
 * dev vs producción para no degradar silenciosamente la seguridad al desplegar.
 */

/**
 * ¿La app corre en modo producción? `APP_ENV` permite forzarlo (p. ej. en un
 * staging que debe comportarse como producción) por encima de `NODE_ENV`.
 */
export function isProduction(): boolean {
  // APP_ENV solo puede ELEVAR a producción (p. ej. un staging que debe comportarse como
  // prod). NUNCA degrada una producción real: si NODE_ENV es 'production' (lo que fuerza
  // `next start`), el modo estricto se activa pase lo que pase con APP_ENV.
  return process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

const warnedSecrets = new Set<string>();

/**
 * Lee un secreto del entorno con política fail-hard en producción:
 * - En PRODUCCIÓN es OBLIGATORIO y suficientemente largo; si falta o es débil, LANZA.
 *   (Así nunca se cifran historias clínicas ni se firman sesiones con una clave de relleno.)
 * - En DESARROLLO, si falta, usa `devFallback` con una advertencia única en consola.
 *
 * La verificación es perezosa (en el punto de uso), no al cargar el módulo, para no
 * romper `next build`.
 */
export function readRequiredSecret(envName: string, devFallback: string, minLength = 16): string {
  const value = process.env[envName];
  if (value && value.trim().length >= minLength) return value;
  if (isProduction()) {
    throw new Error(
      `[seguridad] ${envName} no está definida o es demasiado corta (mínimo ${minLength} caracteres). ` +
        'En producción es obligatoria; configúrala desde un gestor de secretos.',
    );
  }
  if (!warnedSecrets.has(envName)) {
    warnedSecrets.add(envName);
    console.warn(
      `[seguridad] ${envName} no está definida: usando un valor de desarrollo. ` +
        'NUNCA uses este valor en producción.',
    );
  }
  return devFallback;
}
