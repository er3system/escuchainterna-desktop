/**
 * Campos destino del import flexible de pacientes (v3 §3, universidades).
 *
 * Módulo PURO (sin Node ni value objects): los client components lo importan
 * para pintar los selects de mapeo y la auto-sugerencia por similitud.
 */

export const IMPORT_PATIENT_FIELDS = [
  { id: 'nombre', label: 'Nombre completo', required: true },
  { id: 'correo', label: 'Correo electrónico', required: false },
  { id: 'telefono', label: 'Teléfono / celular', required: false },
  { id: 'lada', label: 'Lada (código de país)', required: false },
  { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', required: false },
  { id: 'genero', label: 'Género', required: false },
  { id: 'contacto_emergencia', label: 'Contacto de emergencia', required: false },
  { id: 'telefono_emergencia', label: 'Teléfono de emergencia', required: false },
  { id: 'notas', label: 'Notas', required: false },
] as const;

export type ImportPatientFieldId = (typeof IMPORT_PATIENT_FIELDS)[number]['id'];

/**
 * Destino de una columna detectada: un campo del paciente, una etiqueta
 * institucional («Columna: valor», p. ej. «Programa: Psicología») o ignorarla.
 */
export type ImportColumnTarget = ImportPatientFieldId | 'etiqueta' | 'ignorar';

/** Mapeo elegido por el usuario para UNA columna del archivo. */
export interface ImportColumnMapping {
  /** Índice de la columna en el archivo (0-based). */
  index: number;
  /** Encabezado original (se usa como prefijo de la etiqueta institucional). */
  header: string;
  target: ImportColumnTarget;
}

export function importFieldLabel(fieldId: ImportPatientFieldId): string {
  return IMPORT_PATIENT_FIELDS.find((field) => field.id === fieldId)?.label ?? fieldId;
}

// ------------------------------------------------------------------
// Auto-sugerencia por similitud
// ------------------------------------------------------------------

const FIELD_ALIASES: Record<ImportPatientFieldId, string[]> = {
  nombre: [
    'nombre',
    'nombres',
    'nombre completo',
    'nombre del paciente',
    'nombres y apellidos',
    'nombre y apellido',
    'paciente',
    'alumno',
    'estudiante',
    'consultante',
  ],
  correo: [
    'correo',
    'email',
    'e-mail',
    'mail',
    'correo electronico',
    'correo institucional',
    'email institucional',
  ],
  telefono: [
    'telefono',
    'tel',
    'celular',
    'movil',
    'whatsapp',
    'numero de telefono',
    'numero celular',
    'telefono celular',
    'numero de contacto',
  ],
  lada: ['lada', 'codigo de pais', 'codigo pais', 'indicativo', 'prefijo', 'prefijo telefonico'],
  fecha_nacimiento: [
    'fecha de nacimiento',
    'fecha nacimiento',
    'nacimiento',
    'fecha nac',
    'fec nac',
    'cumpleanos',
    'f nacimiento',
  ],
  genero: ['genero', 'sexo', 'identidad de genero'],
  contacto_emergencia: [
    'contacto de emergencia',
    'contacto emergencia',
    'emergencia',
    'nombre contacto emergencia',
    'acudiente',
    'tutor',
  ],
  telefono_emergencia: [
    'telefono de emergencia',
    'telefono emergencia',
    'celular emergencia',
    'tel emergencia',
    'numero de emergencia',
  ],
  notas: ['notas', 'nota', 'comentarios', 'observaciones', 'comentario', 'observacion'],
};

/** minúsculas, sin acentos y con separadores colapsados a un espacio. */
export function normalizeHeaderText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_\-./|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de Levenshtein clásica (suficiente para encabezados cortos). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

/** ¿El alias y el encabezado son "lo bastante parecidos"? (tolerante a typos). */
function isSimilar(header: string, alias: string): boolean {
  if (header === alias) return true;
  // Contención de palabra completa: «telefono fijo» ≈ «telefono».
  if (header.length >= 4 && alias.length >= 4 && (header.includes(alias) || alias.includes(header))) {
    return true;
  }
  const distance = levenshtein(header, alias);
  const tolerance = Math.max(1, Math.floor(Math.max(header.length, alias.length) / 5));
  return distance <= tolerance;
}

/**
 * Sugiere el destino de una columna a partir de su encabezado: alias exacto →
 * similitud (typos/variantes) → «etiqueta» (columnas institucionales como
 * Programa, Semestre o Código se conservan como etiquetas del paciente).
 */
export function suggestTargetForHeader(header: string): ImportColumnTarget {
  const normalized = normalizeHeaderText(header);
  if (!normalized) return 'ignorar';

  for (const field of IMPORT_PATIENT_FIELDS) {
    if (FIELD_ALIASES[field.id].includes(normalized)) return field.id;
  }
  // Pasada de similitud: la primera coincidencia gana en el orden declarado
  // (los campos más importantes están primero en IMPORT_PATIENT_FIELDS).
  for (const field of IMPORT_PATIENT_FIELDS) {
    if (FIELD_ALIASES[field.id].some((alias) => isSimilar(normalized, alias))) return field.id;
  }
  return 'etiqueta';
}
