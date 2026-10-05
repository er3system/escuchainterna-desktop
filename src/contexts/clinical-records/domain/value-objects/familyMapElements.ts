// Módulo PURO (sin dependencias de Node ni de @haskou/value-objects):
// los client components del genograma importan estos tipos y constantes.
//
// Genograma clínico (fundamentado en la publicación sistémica-familiar):
// atributos ricos de persona, vocabulario de relaciones estructurales /
// emocionales / dirigidas-tipadas (violencia, control, cuidado) y patrones
// (triangulación, coalición, alianza, repetición transgeneracional).

export type FamilyMemberGender = 'femenino' | 'masculino' | 'otro';

export const FAMILY_GENDERS: FamilyMemberGender[] = ['femenino', 'masculino', 'otro'];

export const FAMILY_GENDER_LABELS: Record<FamilyMemberGender, string> = {
  femenino: 'Femenino (círculo)',
  masculino: 'Masculino (cuadrado)',
  otro: 'Otro / no binario (rombo)',
};

/** Condiciones marcables en un miembro (rellenos convencionales del genograma). */
export type FamilyCondition = 'salud_mental' | 'consumo' | 'medica';

export const FAMILY_CONDITIONS: FamilyCondition[] = ['salud_mental', 'consumo', 'medica'];

export const FAMILY_CONDITION_LABELS: Record<FamilyCondition, string> = {
  salud_mental: 'Salud mental',
  consumo: 'Consumo de sustancias',
  medica: 'Condición médica',
};

/** Vínculo entre dos personas: estructural, emocional o dirigido-tipado. */
export type FamilyLinkKind =
  // Estructurales (líneas familiares)
  | 'matrimonio'
  | 'union_libre'
  | 'separacion'
  | 'divorcio'
  | 'hijo'
  // Emocionales
  | 'cercania'
  | 'distante'
  | 'conflicto'
  | 'corte'
  | 'fusion'
  | 'hostil'
  // Dirigidas (la dirección from→to informa clínicamente)
  | 'violencia'
  | 'control'
  | 'cuidado';

export const FAMILY_LINK_KINDS: FamilyLinkKind[] = [
  'matrimonio',
  'union_libre',
  'separacion',
  'divorcio',
  'hijo',
  'cercania',
  'distante',
  'conflicto',
  'corte',
  'fusion',
  'hostil',
  'violencia',
  'control',
  'cuidado',
];

export const FAMILY_LINK_LABELS: Record<FamilyLinkKind, string> = {
  matrimonio: 'Matrimonio / unión',
  union_libre: 'Unión libre',
  separacion: 'Separación',
  divorcio: 'Divorcio',
  hijo: 'Hijo/a (filiación)',
  cercania: 'Cercanía',
  distante: 'Relación distante',
  conflicto: 'Conflicto',
  corte: 'Corte / distanciamiento',
  fusion: 'Muy cercana / fusionada',
  hostil: 'Hostil',
  violencia: 'Violencia / abuso',
  control: 'Control',
  cuidado: 'Cuidado / protección',
};

/** Agrupación para el desplegable del editor (optgroups). */
export const FAMILY_LINK_GROUPS: { label: string; kinds: FamilyLinkKind[] }[] = [
  { label: 'Estructural', kinds: ['matrimonio', 'union_libre', 'separacion', 'divorcio', 'hijo'] },
  { label: 'Emocional', kinds: ['cercania', 'distante', 'conflicto', 'corte', 'fusion', 'hostil'] },
  { label: 'Dirigida (con dirección)', kinds: ['violencia', 'control', 'cuidado'] },
];

/** Vínculos cuya DIRECCIÓN (from→to) tiene significado clínico. */
const DIRECTED_LINK_KINDS = new Set<FamilyLinkKind>(['hijo', 'violencia', 'control', 'cuidado']);

export function isDirectedLink(kind: FamilyLinkKind): boolean {
  return DIRECTED_LINK_KINDS.has(kind);
}

/** Tipo de violencia (terapia-pareja): situacional (bidireccional) vs. coercitiva (asimétrica). */
export type ViolenceType = '' | 'situacional' | 'coercitiva';

export const VIOLENCE_TYPES: ViolenceType[] = ['situacional', 'coercitiva'];

export const VIOLENCE_TYPE_LABELS: Record<Exclude<ViolenceType, ''>, string> = {
  situacional: 'Situacional (episódica)',
  coercitiva: 'Coercitiva / de control',
};

/** Patrones relacionales que el genograma ayuda a marcar (no son una línea). */
export type FamilyPatternKind = 'triangulacion' | 'coalicion' | 'alianza' | 'repeticion';

export const FAMILY_PATTERN_KINDS: FamilyPatternKind[] = [
  'triangulacion',
  'coalicion',
  'alianza',
  'repeticion',
];

export const FAMILY_PATTERN_LABELS: Record<FamilyPatternKind, string> = {
  triangulacion: 'Triangulación',
  coalicion: 'Coalición',
  alianza: 'Alianza',
  repeticion: 'Repetición transgeneracional',
};

export interface FamilyMapMember {
  id: string;
  name: string;
  /** Relación con el paciente: madre, padre, hermana, pareja, paciente… */
  relation: string;
  gender: FamilyMemberGender;
  deceased: boolean;
  /** Año de fallecimiento (solo si `deceased`). */
  deceasedYear: number | null;
  age: number | null;
  /** Paciente identificado por la familia (doble contorno). */
  identifiedPatient: boolean;
  /** Condiciones marcables (rellenos del símbolo). */
  conditions: FamilyCondition[];
  /** Rol funcional en el sistema: parentalizado, cuidador, chivo expiatorio… */
  role: string;
  /** ¿Convive en el hogar actual? (recuadro del hogar). */
  household: boolean;
  /** Notas clínicas / hipótesis sobre la persona. */
  notes: string;
  x: number;
  y: number;
}

export interface FamilyMapLink {
  id: string;
  fromId: string;
  toId: string;
  kind: FamilyLinkKind;
  /** Solo para `violencia`: situacional | coercitiva. */
  violenceType: ViolenceType;
  /** Nota clínica del vínculo. */
  notes: string;
}

export interface FamilyMapPattern {
  id: string;
  kind: FamilyPatternKind;
  /** Personas implicadas (2-3). */
  memberIds: string[];
  note: string;
}

export interface FamilyMapData {
  members: FamilyMapMember[];
  links: FamilyMapLink[];
  patterns: FamilyMapPattern[];
}

export interface FamilyMapPrimitives {
  id: string;
  patientId: string;
  title: string;
  data: FamilyMapData;
  createdAt: string;
  updatedAt: string;
}

function isGender(value: unknown): value is FamilyMemberGender {
  return typeof value === 'string' && (FAMILY_GENDERS as string[]).includes(value);
}

function isLinkKind(value: unknown): value is FamilyLinkKind {
  return typeof value === 'string' && (FAMILY_LINK_KINDS as string[]).includes(value);
}

function isCondition(value: unknown): value is FamilyCondition {
  return typeof value === 'string' && (FAMILY_CONDITIONS as string[]).includes(value);
}

function isPatternKind(value: unknown): value is FamilyPatternKind {
  return typeof value === 'string' && (FAMILY_PATTERN_KINDS as string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Lienzo lógico del genograma (coordenadas persistidas dentro de estos límites). */
export const FAMILY_MAP_CANVAS = { width: 980, height: 700 };

/**
 * Valida y normaliza el JSON del mapa (posiciones incluidas) descartando basura:
 * miembros sin nombre, vínculos hacia miembros inexistentes, etc. Compatible
 * hacia atrás: los mapas antiguos (sin los campos nuevos) reciben valores por
 * defecto.
 */
export function normalizeFamilyMapData(raw: unknown): FamilyMapData {
  const data: FamilyMapData = { members: [], links: [], patterns: [] };
  if (typeof raw !== 'object' || raw === null) return data;
  const candidate = raw as Record<string, unknown>;

  const rawMembers = Array.isArray(candidate.members) ? candidate.members : [];
  for (const item of rawMembers) {
    if (typeof item !== 'object' || item === null) continue;
    const member = item as Record<string, unknown>;
    const id = typeof member.id === 'string' ? member.id.trim() : '';
    const name = typeof member.name === 'string' ? member.name.trim() : '';
    if (!id || !name) continue;
    if (data.members.some((existing) => existing.id === id)) continue;
    const age = Number(member.age);
    const deceased = member.deceased === true;
    const deceasedYear = Number(member.deceasedYear);
    const conditions = Array.isArray(member.conditions)
      ? [...new Set(member.conditions.filter(isCondition))]
      : [];
    data.members.push({
      id,
      name: name.slice(0, 80),
      relation: typeof member.relation === 'string' ? member.relation.trim().slice(0, 60) : '',
      gender: isGender(member.gender) ? member.gender : 'otro',
      deceased,
      deceasedYear:
        deceased && Number.isFinite(deceasedYear) && deceasedYear >= 1900 && deceasedYear <= 2200
          ? Math.trunc(deceasedYear)
          : null,
      age: Number.isFinite(age) && age >= 0 && age < 130 ? Math.trunc(age) : null,
      identifiedPatient: member.identifiedPatient === true,
      conditions,
      role: typeof member.role === 'string' ? member.role.trim().slice(0, 60) : '',
      household: member.household === true,
      notes: typeof member.notes === 'string' ? member.notes.trim().slice(0, 500) : '',
      x: clamp(Number(member.x) || 0, 40, FAMILY_MAP_CANVAS.width - 40),
      y: clamp(Number(member.y) || 0, 40, FAMILY_MAP_CANVAS.height - 40),
    });
  }

  const memberIds = new Set(data.members.map((member) => member.id));
  const rawLinks = Array.isArray(candidate.links) ? candidate.links : [];
  for (const item of rawLinks) {
    if (typeof item !== 'object' || item === null) continue;
    const link = item as Record<string, unknown>;
    const id = typeof link.id === 'string' ? link.id.trim() : '';
    const fromId = typeof link.fromId === 'string' ? link.fromId.trim() : '';
    const toId = typeof link.toId === 'string' ? link.toId.trim() : '';
    if (!id || !fromId || !toId || fromId === toId) continue;
    if (!memberIds.has(fromId) || !memberIds.has(toId)) continue;
    if (data.links.some((existing) => existing.id === id)) continue;
    const kind = isLinkKind(link.kind) ? link.kind : 'matrimonio';
    const violenceType =
      kind === 'violencia' && (link.violenceType === 'situacional' || link.violenceType === 'coercitiva')
        ? link.violenceType
        : '';
    data.links.push({
      id,
      fromId,
      toId,
      kind,
      violenceType,
      notes: typeof link.notes === 'string' ? link.notes.trim().slice(0, 300) : '',
    });
  }

  const rawPatterns = Array.isArray(candidate.patterns) ? candidate.patterns : [];
  for (const item of rawPatterns) {
    if (typeof item !== 'object' || item === null) continue;
    const pattern = item as Record<string, unknown>;
    const id = typeof pattern.id === 'string' ? pattern.id.trim() : '';
    if (!id || !isPatternKind(pattern.kind)) continue;
    if (data.patterns.some((existing) => existing.id === id)) continue;
    const ids = Array.isArray(pattern.memberIds)
      ? [...new Set(pattern.memberIds.filter((m): m is string => typeof m === 'string' && memberIds.has(m)))]
      : [];
    if (ids.length < 2) continue;
    data.patterns.push({
      id,
      kind: pattern.kind,
      memberIds: ids.slice(0, 3),
      note: typeof pattern.note === 'string' ? pattern.note.trim().slice(0, 300) : '',
    });
  }

  return data;
}
