/**
 * Vocabulario CANÓNICO de modelos terapéuticos del expediente v2 (spec §2, §3).
 *
 * Una sola convención de `key` para TODO el sistema: la usan las plantillas-modelo
 * ("Iniciar historia clínica") y la usarán los `relevantModels` de los bloques
 * curados (Fase 2). Evita la deriva `humanista` vs `humanismo-centrado-persona`:
 * la `key` es la identidad de máquina; el id de la publicación fuente y el id de
 * la plantilla integrada viven aparte, mapeados aquí en un único lugar.
 *
 * En Fase 1 los descriptores aportan metadatos (nombre, enfoque, cuándo usarlo,
 * previsualización, fuente, plantilla integrada existente). El `nucleoSections`
 * de cada modelo se redacta en Fase 2 leyendo cada publicación.
 *
 * Módulo PURO (sin Node): importable desde el cliente.
 */

/** Las 15 plantillas-modelo del catálogo (spec §3). `general` es la base transversal; `libre` es texto libre. */
export const MODEL_KEYS = [
  'general',
  'libre',
  'tcc',
  'trec',
  'act',
  'activacion-conductual',
  'dbt',
  'psicodinamica',
  'humanista',
  'gestalt',
  'sistemica-familiar',
  'breve-soluciones',
  'parejas',
  'infantil',
  'evaluacion',
] as const;

export type ModelKey = (typeof MODEL_KEYS)[number];

export interface ModelDescriptor {
  /** Identidad de máquina del modelo (vocabulario unificado). */
  key: ModelKey;
  /** Nombre presentable del modelo-plantilla. */
  name: string;
  /** Etiqueta corta del enfoque (para chips y filtros). */
  enfoque: string;
  /** Una frase: en qué casos elegir este modelo. */
  whenToUse: string;
  /** 2-3 frases para previsualizar antes de elegir la plantilla. */
  preview: string;
  /** Ids de publicación(es) fuente en `data/publicaciones` (vacío si no aplica). */
  sourcePublicationIds: string[];
  /**
   * Id de la plantilla integrada que YA existe para este modelo en
   * `builtinTemplates.ts`, o null si hay que crearla (Fase 2).
   */
  builtinTemplateId: string | null;
}

/**
 * Catálogo de los 15 modelos. El orden es el de presentación al "Iniciar
 * historia clínica" (general primero como base transversal; libre como
 * alternativa de texto libre justo después).
 */
export const MODEL_DESCRIPTORS: Record<ModelKey, ModelDescriptor> = {
  general: {
    key: 'general',
    name: 'General (admisión transversal)',
    enfoque: 'General',
    whenToUse: 'El punto de partida cuando aún no defines un enfoque: una admisión clínica completa válida para cualquier modelo.',
    preview:
      'Recoge identificación, motivo de consulta, antecedentes, examen mental e impresión diagnóstica con plan inicial. Es la base transversal sobre la que luego añades bloques o pivotas a un modelo específico.',
    sourcePublicationIds: [],
    builtinTemplateId: 'builtin-historia-general',
  },
  libre: {
    key: 'libre',
    name: 'Historia libre (texto)',
    enfoque: 'Texto libre',
    whenToUse: 'Cuando prefieres escribir toda la historia clínica a mano, en un solo campo, sin secciones predefinidas.',
    preview:
      'Un único espacio de texto para redactar la historia clínica completa con tus propias palabras y tu propia estructura. Útil si te resulta más natural narrar que llenar campos; siempre puedes añadir bloques después.',
    sourcePublicationIds: [],
    builtinTemplateId: 'builtin-historia-libre',
  },
  tcc: {
    key: 'tcc',
    name: 'Cognitivo-conductual (TCC)',
    enfoque: 'Cognitivo-conductual',
    whenToUse: 'Cuando trabajarás la relación entre situaciones, pensamientos, emociones y conductas con técnicas estructuradas.',
    preview:
      'Núcleo con análisis funcional A-B-C, pensamientos automáticos y esquemas cognitivos, medición del malestar (SUDs) y objetivos operacionalizados. Orienta hacia reestructuración cognitiva, exposición y activación conductual.',
    sourcePublicationIds: ['tcc'],
    builtinTemplateId: 'builtin-tcc',
  },
  trec: {
    key: 'trec',
    name: 'TREC / Modelo ABC (Ellis)',
    enfoque: 'Racional emotiva conductual',
    whenToUse: 'Cuando el foco son las creencias irracionales y las demandas absolutistas que sostienen el malestar.',
    preview:
      'Núcleo organizado en el modelo A-B-C: acontecimiento activador, creencias (racionales e irracionales) y consecuencias emocionales y conductuales, con el debate de creencias como eje de la intervención.',
    sourcePublicationIds: ['trec-modelo-abc'],
    builtinTemplateId: 'builtin-trec',
  },
  act: {
    key: 'act',
    name: 'Contextual (ACT y mindfulness)',
    enfoque: 'Contextual / ACT',
    whenToUse: 'Cuando buscas flexibilidad psicológica —aceptación, defusión y acción comprometida con los valores— más que eliminar síntomas.',
    preview:
      'Núcleo basado en el hexaflex: evitación experiencial, fusión cognitiva, contacto con el presente, valores y acción comprometida, con el mindfulness como práctica transversal.',
    sourcePublicationIds: ['act-mindfulness'],
    builtinTemplateId: 'builtin-act',
  },
  'activacion-conductual': {
    key: 'activacion-conductual',
    name: 'Activación conductual',
    enfoque: 'Activación conductual',
    whenToUse: 'Especialmente en depresión: reactivar la conducta con sentido para romper el círculo de evitación e inactividad.',
    preview:
      'Núcleo con registro de actividades y estado de ánimo, valores por áreas vitales, jerarquía de actividades programadas y trabajo con los patrones de evitación.',
    sourcePublicationIds: ['activacion-conductual'],
    builtinTemplateId: 'builtin-activacion-conductual',
  },
  dbt: {
    key: 'dbt',
    name: 'Dialéctico-conductual (DBT)',
    enfoque: 'Dialéctico-conductual',
    whenToUse: 'Para desregulación emocional intensa, conducta suicida o autolesiva y rasgos límite: equilibrio aceptación-cambio y habilidades.',
    preview:
      'Núcleo con teoría biosocial, jerarquía de objetivos (conductas que amenazan la vida, la terapia y la calidad de vida) y los cuatro módulos de habilidades, con el análisis en cadena como herramienta central.',
    sourcePublicationIds: ['dbt'],
    builtinTemplateId: 'builtin-dbt',
  },
  psicodinamica: {
    key: 'psicodinamica',
    name: 'Psicodinámica / psicoanalítica',
    enfoque: 'Psicodinámica',
    whenToUse: 'Cuando el trabajo se centra en los patrones relacionales, las defensas y la transferencia más que en el síntoma manifiesto.',
    preview:
      'Núcleo con historia vincular, relaciones de objeto y funcionamiento psíquico, material onírico y vida de fantasía, y la transferencia inicial con su encuadre.',
    sourcePublicationIds: ['psicodinamica'],
    builtinTemplateId: 'builtin-psicodinamica',
  },
  humanista: {
    key: 'humanista',
    name: 'Humanista / centrado en la persona',
    enfoque: 'Humanista',
    whenToUse: 'Cuando priorizas la relación, la empatía y la tendencia actualizante del consultante por encima de la técnica.',
    preview:
      'Núcleo centrado en la experiencia y los recursos del consultante y en la fenomenología del problema, con las condiciones de Rogers (empatía, aceptación incondicional, congruencia) como marco de la relación.',
    sourcePublicationIds: ['humanismo-centrado-persona'],
    builtinTemplateId: 'builtin-humanista',
  },
  gestalt: {
    key: 'gestalt',
    name: 'Gestalt',
    enfoque: 'Gestalt',
    whenToUse: 'Cuando trabajas el aquí y ahora, el darse cuenta y los asuntos inconclusos con técnicas vivenciales.',
    preview:
      'Núcleo con el ciclo de la experiencia, los bloqueos de contacto y los asuntos inconclusos, con técnicas vivenciales como la silla vacía y el trabajo de dos sillas.',
    sourcePublicationIds: ['gestalt'],
    builtinTemplateId: 'builtin-gestalt',
  },
  'sistemica-familiar': {
    key: 'sistemica-familiar',
    name: 'Sistémica / familiar',
    enfoque: 'Sistémica / familiar',
    whenToUse: 'Cuando el problema se entiende en la red de relaciones: pareja, familia o un sistema más amplio.',
    preview:
      'Núcleo con composición y genograma, etapa del ciclo vital, patrones de comunicación, estructura (alianzas, coaliciones y límites) y recursos del sistema.',
    sourcePublicationIds: ['sistemica-familiar'],
    builtinTemplateId: 'builtin-familiar',
  },
  'breve-soluciones': {
    key: 'breve-soluciones',
    name: 'Breve centrada en soluciones',
    enfoque: 'Breve en soluciones',
    whenToUse: 'Cuando buscas cambios verificables en pocas sesiones construyendo soluciones más que analizando el problema.',
    preview:
      'Núcleo con objetivos bien formados, excepciones al problema, la pregunta del milagro y escalas de avance para medir el cambio sesión a sesión.',
    sourcePublicationIds: ['breve-soluciones'],
    builtinTemplateId: 'builtin-breve-soluciones',
  },
  parejas: {
    key: 'parejas',
    name: 'Parejas',
    enfoque: 'Pareja',
    whenToUse: 'Para la primera evaluación conjunta de una pareja: historia de la relación, ciclo de conflicto y compromiso con el proceso.',
    preview:
      'Núcleo con datos de ambos miembros, historia de la relación, motivo según cada miembro, áreas de conflicto con cribado de violencia, e intentos de solución y compromiso.',
    sourcePublicationIds: ['terapia-pareja'],
    builtinTemplateId: 'builtin-pareja',
  },
  infantil: {
    key: 'infantil',
    name: 'Infantil y adolescentes',
    enfoque: 'Infanto-juvenil',
    whenToUse: 'Para menores de edad: historia evolutiva, escolar y familiar, con la voz del niño o adolescente y la de sus cuidadores.',
    preview:
      'Núcleo con motivo según padres y según el menor, datos de tutores, embarazo y desarrollo evolutivo, historia escolar, juego y conducta, y dinámica familiar.',
    sourcePublicationIds: ['psicologia-infantil', 'adolescencia'],
    builtinTemplateId: 'builtin-infantil',
  },
  evaluacion: {
    key: 'evaluacion',
    name: 'Evaluación / neuropsicología',
    enfoque: 'Evaluación / neuropsicología',
    whenToUse: 'Cuando el encargo es evaluar (psicométrica o neuropsicológica) y emitir un perfil o dictamen, no necesariamente tratar.',
    preview:
      'Núcleo con motivo de derivación y pregunta clínica, historia médica y neurológica, perfil premórbido, áreas e instrumentos a aplicar, y observaciones conductuales durante la evaluación.',
    sourcePublicationIds: [],
    builtinTemplateId: 'builtin-neuropsicologica',
  },
};

/** Lista ordenada de descriptores (orden de `MODEL_KEYS`). */
export function modelDescriptors(): ModelDescriptor[] {
  return MODEL_KEYS.map((key) => MODEL_DESCRIPTORS[key]);
}

/** ¿Es `value` una key de modelo canónica? */
export function isModelKey(value: unknown): value is ModelKey {
  return typeof value === 'string' && (MODEL_KEYS as readonly string[]).includes(value);
}

/**
 * Modelos cuyo núcleo es ESPECÍFICO del enfoque (no incluyen la admisión
 * transversal) y, por tanto, se COMPONEN sobre el núcleo general al iniciar la
 * historia (§3: "las preguntas globales de admisión adaptadas a ese modelo").
 * Los demás (general y los modelos legacy autocontenidos) ya traen su propia
 * admisión y se usan tal cual.
 */
const COMPOSES_WITH_GENERAL: ReadonlySet<ModelKey> = new Set<ModelKey>([
  'trec',
  'act',
  'activacion-conductual',
  'dbt',
  'humanista',
  'gestalt',
  'breve-soluciones',
]);

/** ¿El núcleo de este modelo se compone sobre la admisión general (§3)? */
export function modelComposesWithGeneralNucleo(key: ModelKey): boolean {
  return COMPOSES_WITH_GENERAL.has(key);
}

/** Descriptor del modelo cuya plantilla integrada es `templateId` (o null). */
export function modelDescriptorForTemplateId(templateId: string | null): ModelDescriptor | null {
  if (!templateId) return null;
  return modelDescriptors().find((descriptor) => descriptor.builtinTemplateId === templateId) ?? null;
}
