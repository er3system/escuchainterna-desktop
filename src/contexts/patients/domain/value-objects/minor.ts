/**
 * Helpers PUROS de minoría de edad / representante legal (acudiente). Módulo aislado a
 * propósito: NO importa Patient.ts ni @haskou/value-objects (que arrastra node:crypto), para
 * poder usarlo desde CLIENT components (el alta y el panel del paciente) sin romper el bundle.
 */

/** Mayoría de edad legal (Colombia y la mayoría de jurisdicciones): 18 años. */
export const LEGAL_ADULT_AGE = 18;

/**
 * ¿El paciente es menor de edad (< 18) a la fecha `now`? birthDate en AAAA-MM-DD
 * (o null/formato inválido → false: sin fecha válida no se puede afirmar minoría).
 * `now` es inyectable para tests deterministas (default new Date()).
 */
export function isMinor(birthDate: string | null, now: Date = new Date()): boolean {
  if (!birthDate) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Edad cumplida a la fecha `now` (resta de años con ajuste por mes/día).
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age -= 1;
  return age < LEGAL_ADULT_AGE;
}

/** Representante legal (acudiente) del paciente, obligatorio para menores. */
export interface PatientGuardian {
  name: string;
  relationship: string;
  document: string;
}
