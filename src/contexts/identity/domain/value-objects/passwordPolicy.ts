import { WeakPasswordError } from '../errors/WeakPasswordError';

/**
 * Política de contraseñas (módulo PURO). Para una app de historias clínicas el
 * mínimo de 6 es insuficiente. Reglas:
 * - mínimo 10 caracteres;
 * - al menos una letra Y un número, salvo que sea una frase larga (≥ 14) — así
 *   se admiten passphrases sin obligar a mezclar tipos;
 * - se rechazan contraseñas notoriamente comunes.
 */

export const MIN_PASSWORD_LENGTH = 10;
const PASSPHRASE_EXEMPTION_LENGTH = 14;

/** Lista corta de contraseñas demasiado comunes (en minúsculas). */
const COMMON_PASSWORDS = new Set([
  'contrasena',
  'contraseña',
  'password',
  'passw0rd',
  'password1',
  '1234567890',
  '123456789',
  '12345678',
  'qwertyuiop',
  'qwerty123',
  'iloveyou',
  'admin1234',
  'bienvenido',
]);

/** Raíces predecibles: si la contraseña CONTIENE alguna, se rechaza (cubre 'Password1!', 'qwerty123', etc.). */
const COMMON_ROOTS = ['password', 'contrasena', 'contraseña', 'qwerty', '123456', 'iloveyou'];

export function assertStrongPassword(plain: string): void {
  const password = plain ?? '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const hasLetter = /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(password);
  const hasNumber = /\d/.test(password);
  if (password.length < PASSPHRASE_EXEMPTION_LENGTH && !(hasLetter && hasNumber)) {
    throw new WeakPasswordError(
      'Usa al menos una letra y un número, o una frase de 14 caracteres o más.',
    );
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || COMMON_ROOTS.some((root) => lower.includes(root))) {
    throw new WeakPasswordError('Esa contraseña es demasiado común o predecible; elige otra.');
  }
}
