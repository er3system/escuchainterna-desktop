/**
 * Versiones VIGENTES de los documentos legales (identificadas por fecha; ver /legal/*).
 * Fuente ÚNICA de verdad: el mismo string se MUESTRA en las páginas legales (su
 * `updatedAt`) y se SELLA en `users` al aceptar durante el registro, para tener prueba
 * de QUÉ versión aceptó cada profesional y CUÁNDO (Ley 1581 — autorización informada).
 * Al cambiar el texto de un documento, sube su fecha aquí y en la página correspondiente.
 */
export const LEGAL_VERSIONS = {
  terms: '22 de junio de 2026',
  privacy: '11 de junio de 2026',
} as const;

/** Documentos propios de la instalación local; no se sellan versiones del servicio SaaS. */
export const DESKTOP_LEGAL_VERSIONS = {
  terms: '5 de octubre de 2026 · Edición PC',
  privacy: '5 de octubre de 2026 · Edición PC',
} as const;
