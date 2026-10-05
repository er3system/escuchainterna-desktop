// Perfil clínico de un caso relacional (vínculos): evaluación del sistema, objetivos,
// línea de tiempo de eventos y mapa de relaciones entre miembros. Módulo PURO (sin Node):
// importable desde el cliente. Se persiste como un único JSON cifrado at-rest.

export type MemberRelationQuality =
  | 'cercano'
  | 'conflictivo'
  | 'distante'
  | 'cortado'
  | 'ambivalente'
  | 'fusionado';

export const MEMBER_RELATION_QUALITIES: MemberRelationQuality[] = [
  'cercano',
  'conflictivo',
  'distante',
  'cortado',
  'ambivalente',
  'fusionado',
];

export const MEMBER_RELATION_LABELS: Record<MemberRelationQuality, string> = {
  cercano: 'Cercano',
  conflictivo: 'Conflictivo',
  distante: 'Distante',
  cortado: 'Cortado',
  ambivalente: 'Ambivalente',
  fusionado: 'Fusionado',
};

/** Evaluación del sistema: el "núcleo" relacional del caso (ciclo, estructura, comunicación). */
export interface SystemEval {
  /** Etapa del ciclo vital familiar (Carter–McGoldrick / Haley). */
  lifeCycleStage: string;
  /** Estructura: subsistemas, límites, jerarquías, alianzas y coaliciones (Minuchin). */
  structure: string;
  /** Patrones de comunicación y secuencias circulares. */
  communication: string;
  /** Motivo de consulta del SISTEMA (vs. el de cada miembro). */
  systemMotive: string;
}

export interface CaseEvent {
  id: string;
  /** Fecha del evento (ISO o libre: 'YYYY' o 'YYYY-MM'). */
  date: string;
  title: string;
  note: string;
}

export interface MemberRelation {
  id: string;
  aMemberId: string;
  bMemberId: string;
  quality: MemberRelationQuality;
  note: string;
}

export interface CaseProfile {
  systemEval: SystemEval;
  objectives: string;
  events: CaseEvent[];
  relations: MemberRelation[];
}

export const EMPTY_SYSTEM_EVAL: SystemEval = {
  lifeCycleStage: '',
  structure: '',
  communication: '',
  systemMotive: '',
};

export const EMPTY_CASE_PROFILE: CaseProfile = {
  systemEval: { ...EMPTY_SYSTEM_EVAL },
  objectives: '',
  events: [],
  relations: [],
};

export function isMemberRelationQuality(value: unknown): value is MemberRelationQuality {
  return typeof value === 'string' && (MEMBER_RELATION_QUALITIES as string[]).includes(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Parser tolerante: un JSON corrupto o vacío devuelve el perfil vacío (nunca lanza). */
export function parseCaseProfile(json: string): CaseProfile {
  if (!json || json.trim() === '') return { ...EMPTY_CASE_PROFILE, systemEval: { ...EMPTY_SYSTEM_EVAL } };
  try {
    const raw = JSON.parse(json) as Partial<CaseProfile>;
    const se = (raw.systemEval ?? {}) as Partial<SystemEval>;
    return {
      systemEval: {
        lifeCycleStage: asString(se.lifeCycleStage),
        structure: asString(se.structure),
        communication: asString(se.communication),
        systemMotive: asString(se.systemMotive),
      },
      objectives: asString(raw.objectives),
      events: Array.isArray(raw.events)
        ? raw.events.map((e) => ({
            id: asString(e?.id),
            date: asString(e?.date),
            title: asString(e?.title),
            note: asString(e?.note),
          }))
        : [],
      relations: Array.isArray(raw.relations)
        ? raw.relations.map((r) => ({
            id: asString(r?.id),
            aMemberId: asString(r?.aMemberId),
            bMemberId: asString(r?.bMemberId),
            quality: isMemberRelationQuality(r?.quality) ? r.quality : 'cercano',
            note: asString(r?.note),
          }))
        : [],
    };
  } catch {
    return { ...EMPTY_CASE_PROFILE, systemEval: { ...EMPTY_SYSTEM_EVAL } };
  }
}

/** Clave no ordenada de un par de miembros (para evitar duplicar la relación A-B / B-A). */
export function relationPairKey(aMemberId: string, bMemberId: string): string {
  return [aMemberId, bMemberId].sort().join('::');
}
