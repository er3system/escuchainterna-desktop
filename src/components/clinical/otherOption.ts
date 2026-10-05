/**
 * Patrón "Otro → ¿cuáles?" (expediente v2 §4). Cuando un campo de selección
 * (seleccion / opcion_multiple / casillas) marca `allowsOther` y el usuario elige
 * la opción tipo "Otro/Otra/Otras", se despliega un campo de texto OPCIONAL para
 * aclarar. La aclaración se guarda INLINE en el propio valor, anotando la opción:
 * `"Otras: ketamina"`. Así una pieza = un valor (sin claves extra en answers) y
 * el texto queda legible en exportaciones.
 *
 * Módulo PURO (sin React/Node): testeable en aislamiento y usable en cliente.
 */

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '').trim();
}

/** Separador entre la opción base y su aclaración. */
const SEPARATOR = ': ';

/** ¿La opción es del tipo "Otro / Otra / Otras" (admite aclaración)? */
export function isOtherOption(option: string): boolean {
  return normalize(option).startsWith('otr');
}

/** La opción "Otro/Otra/Otras" de un campo (la primera que aparezca), o undefined. */
export function findOtherOption(options: readonly string[] | undefined): string | undefined {
  return (options ?? []).find(isOtherOption);
}

/**
 * Opción base de un valor que puede venir anotado: `"Otras: x"` → `"Otras"`.
 * Solo separa si la parte previa al separador es una opción "Otro"; un valor
 * normal que contenga `": "` se devuelve intacto.
 */
export function baseOption(value: string): string {
  const index = value.indexOf(SEPARATOR);
  if (index < 0) return value;
  const head = value.slice(0, index);
  return isOtherOption(head) ? head : value;
}

/** Texto de aclaración de un valor anotado: `"Otras: x"` → `"x"`; `""` si no tiene. */
export function otherDetail(value: string): string {
  const index = value.indexOf(SEPARATOR);
  if (index < 0) return '';
  const head = value.slice(0, index);
  return isOtherOption(head) ? value.slice(index + SEPARATOR.length) : '';
}

/** Compone el valor a partir de la opción "Otro" y su aclaración (sin texto = solo la opción). */
export function composeOther(option: string, detail: string): string {
  const trimmed = detail.trim();
  return trimmed ? `${option}${SEPARATOR}${trimmed}` : option;
}

/** ¿Este valor corresponde (anotado o no) a la opción `option`? */
export function matchesOption(value: string, option: string): boolean {
  return value === option || baseOption(value) === option;
}

/** Etiqueta sintética de la opción "otra" cuando el campo no trae una propia. */
export const SYNTHETIC_OTHER_OPTION = 'Otra opción';

interface OtherCapableField {
  type: string;
  allowsOther?: boolean;
  options?: readonly string[];
}

/**
 * Resuelve la opción "otra" efectiva de un campo de selección, o undefined si no
 * la admite. Regla: las CASILLAS (selección múltiple) admiten "otra" por defecto
 * —se desactivan con `allowsOther: false`—; selección y opción múltiple la
 * admiten solo con `allowsOther: true`. Si las opciones ya traen una "Otro/a…",
 * se usa esa; si no, se sintetiza "Otra opción".
 */
export function resolveOtherOption(field: OtherCapableField): string | undefined {
  const enabled = field.type === 'casillas' ? field.allowsOther !== false : field.allowsOther === true;
  if (!enabled) return undefined;
  return findOtherOption(field.options) ?? SYNTHETIC_OTHER_OPTION;
}

/** Opciones a renderizar, añadiendo la "otra" sintética si no existe ya una. */
export function optionsWithOther(
  options: readonly string[] | undefined,
  otherOption: string | undefined,
): string[] {
  const list = [...(options ?? [])];
  if (otherOption !== undefined && !list.some(isOtherOption)) list.push(otherOption);
  return list;
}
