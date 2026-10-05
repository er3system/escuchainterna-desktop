// Módulo PURO (sin dependencias de Node) para que tanto el dominio como los
// client components (alta de paciente, panel de filtros de /pacientes) usen el
// catálogo de tipos de documento sin arrastrar el agregado Patient al bundle.
//
// Catálogo inicial: Colombia (docs/cuentas-institucionales-spec.md §5). El Pasaporte
// es transversal a países. Extensible: añadir descriptores con su `country`.

export type DocumentTypeKey = 'CC' | 'TI' | 'CE' | 'PA' | 'RC';

export interface DocumentTypeDescriptor {
  key: DocumentTypeKey;
  /** Etiqueta larga para el selector del formulario. */
  label: string;
  /** Abreviatura para mostrar junto al número (p. ej. "CC · 1.234.567"). */
  short: string;
  /** ISO del país; '' = transversal (p. ej. Pasaporte). */
  country: string;
}

export const DOCUMENT_TYPES: DocumentTypeDescriptor[] = [
  { key: 'CC', label: 'Cédula de ciudadanía (CC)', short: 'CC', country: 'CO' },
  { key: 'TI', label: 'Tarjeta de identidad (TI)', short: 'TI', country: 'CO' },
  { key: 'CE', label: 'Cédula de extranjería (CE)', short: 'CE', country: 'CO' },
  { key: 'PA', label: 'Pasaporte', short: 'Pasaporte', country: '' },
  { key: 'RC', label: 'Registro civil / NUIP (RC)', short: 'RC', country: 'CO' },
];

const DOCUMENT_TYPE_KEYS: DocumentTypeKey[] = DOCUMENT_TYPES.map((entry) => entry.key);

export function isDocumentTypeKey(value: unknown): value is DocumentTypeKey {
  return typeof value === 'string' && (DOCUMENT_TYPE_KEYS as string[]).includes(value);
}

export function documentTypeShort(key: DocumentTypeKey | ''): string {
  if (key === '') return '';
  return DOCUMENT_TYPES.find((entry) => entry.key === key)?.short ?? key;
}

/** Texto compacto del documento para mostrar (p. ej. "CC · 1234567"); '' si no hay. */
export function formatPatientDocument(type: DocumentTypeKey | '', number: string): string {
  const trimmed = number.trim();
  if (!trimmed) return '';
  const short = documentTypeShort(type);
  return short ? `${short} · ${trimmed}` : trimmed;
}
