/**
 * Preferencias clínicas por usuario (expediente v2). Por ahora una sola: la
 * plantilla-modelo por defecto al iniciar una historia clínica (§3). Módulo PURO.
 */

/** Clave de la preferencia "plantilla por defecto" en `user_preferences`. */
export const HISTORIA_DEFAULT_TEMPLATE_KEY = 'historia_default_template';

/** Normaliza el id de plantilla por defecto: vacío o nulo ⇒ sin preferencia. */
export function normalizeDefaultTemplateId(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
