import {
  BUILTIN_CLINICAL_TEMPLATES,
  type ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import { isModelKey, type ModelKey } from './modelKeys';

/**
 * Catálogo CURADO de bloques del expediente v2 (spec §4). A diferencia de la v1
 * (que derivaba mecánicamente un bloque por cada sección de las plantillas), aquí
 * cada bloque es una pieza fina elegida a mano: una evaluación, una técnica, un
 * proceso o una estructura reutilizable que se AÑADE al núcleo o a una sesión.
 *
 * Regla de UNA SOLA FUENTE (§2): el contenido que un modelo ya hornea en su
 * núcleo NO se duplica aquí; `relevantModels` señala (en positivo) los modelos
 * para los que el bloque es la herramienta natural cuando NO está ya en su núcleo.
 *
 * Módulo PURO (sin Node): importable desde el editor (client component).
 */

/** Id de la plantilla que define el NÚCLEO por defecto de la historia clínica. */
export const HISTORIA_NUCLEO_TEMPLATE_ID = 'builtin-historia-general';

/** Secciones genéricas que no forman parte del núcleo ofrecible. */
const EXCLUDED_SECTION_IDS = new Set(['notas-adicionales']);

/** Familia del bloque (§4). */
export type BlockCategory = 'Evaluación' | 'Técnica' | 'Proceso' | 'Estructural';

/** Orden canónico de las categorías para el desplegable. */
export const BLOCK_CATEGORIES: BlockCategory[] = ['Evaluación', 'Técnica', 'Proceso', 'Estructural'];

/** Dónde puede añadirse un bloque (§4). */
export type BlockAddableIn = 'primera' | 'sesion' | 'nucleo';

export interface HistoriaBlock {
  /** Id curado y estable del bloque, con prefijo `bloque:` (namespaced, §10). */
  id: string;
  /** Familia del bloque. */
  category: BlockCategory;
  /** Nombre presentable del bloque. */
  title: string;
  /** Descripción breve para el buscador. */
  description: string;
  /** Dónde se puede añadir (primera entrevista, sesión de seguimiento, núcleo). */
  addableIn: BlockAddableIn[];
  /** Modelos para los que es especialmente pertinente ([] = transversal a todos). */
  relevantModels: ModelKey[];
  /** ¿Genera un hilo de continuación "Evolución X" en sesiones siguientes? (§5) */
  hasContinuation: boolean;
  /** La sección reutilizable (con sus campos) que se añade a la historia. */
  section: ClinicalSection;
}

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '');
}

/** Construye un bloque curado, fijando el id namespaced (`bloque:<sectionId>`). */
function block(
  category: BlockCategory,
  description: string,
  addableIn: BlockAddableIn[],
  relevantModels: ModelKey[],
  hasContinuation: boolean,
  section: ClinicalSection,
): HistoriaBlock {
  return {
    id: `bloque:${section.id}`,
    category,
    title: section.title,
    description,
    addableIn,
    relevantModels,
    hasContinuation,
    section,
  };
}

const CURATED_BLOCKS: HistoriaBlock[] = [
  // ===================== Evaluación =====================
  block('Evaluación', 'Exploración semiestructurada del estado mental actual.', ['primera', 'sesion', 'nucleo'], [], false, {
    id: 'examen-mental',
    title: 'Examen mental',
    description: 'Exploración semiestructurada del estado mental al momento de la evaluación.',
    fields: [
      { id: 'apariencia-actitud', label: 'Apariencia y actitud', type: 'texto_largo', helpText: 'Higiene, vestimenta, contacto visual, colaboración, psicomotricidad.' },
      { id: 'conciencia-orientacion', label: 'Conciencia y orientación', type: 'seleccion', options: ['Vigil y orientado en tiempo, espacio y persona', 'Orientación parcialmente alterada', 'Desorientación marcada', 'Alteración del nivel de conciencia (obnubilación/estupor)'] },
      { id: 'atencion-memoria', label: 'Atención y memoria', type: 'texto_largo', helpText: 'Concentración, memoria inmediata, reciente y remota.' },
      { id: 'estado-animo-afecto', label: 'Estado de ánimo y afecto', type: 'texto_largo', helpText: 'Ánimo referido, afecto observado, congruencia, modulación y resonancia.' },
      { id: 'curso-contenido-pensamiento', label: 'Curso y contenido del pensamiento', type: 'texto_largo', helpText: 'Velocidad, organización, presencia de ideas delirantes, obsesivas o sobrevaloradas.' },
      { id: 'sensopercepcion', label: 'Sensopercepción (alucinaciones)', type: 'seleccion', options: ['Sin alteraciones', 'Alucinaciones auditivas', 'Alucinaciones visuales', 'Otras alteraciones sensoperceptivas'], allowsOther: true },
      { id: 'juicio-introspeccion', label: 'Juicio e introspección', type: 'texto_largo', helpText: 'Conciencia de enfermedad (insight), juicio de realidad y toma de decisiones.' },
    ],
  }),
  block('Evaluación', 'Evaluación profunda del riesgo suicida, autolesivo y a terceros (basada en C-SSRS).', ['primera', 'sesion', 'nucleo'], [], false, {
    id: 'evaluacion-riesgo',
    title: 'Evaluación del riesgo (suicida / autolesión / terceros)',
    description: 'Evaluación profunda del riesgo basada en la C-SSRS. Documenta con detalle ante cualquier respuesta afirmativa.',
    fields: [
      { id: 'deseo-morir', label: 'Deseo de morir', type: 'seleccion', options: ['No', 'Sí'], helpText: '¿Ha deseado estar muerto/a o no despertar?' },
      { id: 'ideacion-suicida-activa', label: 'Ideación suicida activa', type: 'seleccion', options: ['No', 'Sí, pasiva', 'Sí, activa sin método', 'Sí, activa con método'] },
      { id: 'intensidad-ideacion', label: 'Intensidad / frecuencia de la ideación', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Ausente', scaleMaxLabel: 'Constante e intensa' },
      { id: 'plan-estructurado', label: 'Plan estructurado', type: 'texto_largo', helpText: 'Método, acceso a medios, grado de detalle, oportunidad y temporalidad.' },
      { id: 'intencion', label: 'Intención', type: 'seleccion', options: ['Sin intención', 'Intención ambivalente', 'Intención clara'] },
      { id: 'conducta-previa', label: 'Conducta suicida o autolesiva previa', type: 'texto_largo', helpText: 'Intentos previos, autolesiones no suicidas, letalidad y fecha del evento más reciente.' },
      { id: 'riesgo-terceros', label: 'Riesgo a terceros', type: 'texto_largo', helpText: 'Ideas o conductas de daño a otros, víctima potencial identificada y acceso a medios.' },
      { id: 'factores-riesgo', label: 'Factores de riesgo', type: 'casillas', options: ['Intento(s) previo(s)', 'Antecedente familiar de suicidio', 'Consumo de sustancias', 'Trastorno mental activo', 'Desesperanza', 'Aislamiento social', 'Pérdida o duelo reciente', 'Acceso a medios letales', 'Dolor crónico o enfermedad médica', 'Impulsividad'], allowsOther: true },
      { id: 'factores-protectores', label: 'Factores protectores', type: 'casillas', options: ['Red de apoyo familiar/social', 'Vínculo terapéutico', 'Hijos o personas a cargo', 'Creencias religiosas/espirituales', 'Proyectos a futuro', 'Razones para vivir', 'Buena adherencia al tratamiento', 'Habilidades de afrontamiento'], allowsOther: true },
      { id: 'nivel-riesgo', label: 'Nivel de riesgo', type: 'seleccion', options: ['Sin riesgo', 'Bajo', 'Moderado', 'Alto'] },
    ],
  }),
  block('Evaluación', 'Mapa de la estructura y dinámica familiar en tres generaciones.', ['primera', 'nucleo'], ['sistemica-familiar', 'parejas', 'infantil', 'psicodinamica'], false, {
    id: 'genograma',
    title: 'Genograma / mapa relacional',
    description: 'Mapa de la estructura y dinámica familiar a lo largo de al menos tres generaciones.',
    fields: [
      { id: 'descripcion-generaciones', label: 'Descripción de tres generaciones', type: 'texto_largo', helpText: 'Miembros, edades, uniones, separaciones, fallecimientos y eventos vitales relevantes.' },
      { id: 'relaciones-cortes', label: 'Relaciones significativas y cortes', type: 'texto_largo', helpText: 'Vínculos cercanos, conflictivos, distantes o relaciones cortadas.' },
      { id: 'patrones-repetidos', label: 'Patrones repetidos', type: 'texto_largo', helpText: 'Enfermedad, consumo, conflicto, migración u otros patrones transgeneracionales.' },
      { id: 'miembro-sintomatico', label: 'Miembro sintomático / paciente identificado', type: 'texto_largo', helpText: 'Quién porta el síntoma y qué función cumple en el sistema.' },
    ],
  }),
  block('Evaluación', 'Unidades subjetivas de malestar (SUDs) para una situación concreta.', ['primera', 'sesion', 'nucleo'], ['tcc', 'act'], false, {
    id: 'escala-suds',
    title: 'Escala SUDs (malestar subjetivo)',
    description: 'Unidades subjetivas de malestar para una situación específica.',
    fields: [
      { id: 'situacion-evaluada', label: 'Situación evaluada', type: 'texto_corto' },
      { id: 'suds-actual', label: 'SUDs actual', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Sin malestar', scaleMaxLabel: 'Malestar máximo' },
      { id: 'contexto-notas', label: 'Contexto / notas', type: 'texto_largo' },
    ],
  }),
  block('Evaluación', 'Etapa de cambio (Prochaska y DiClemente) y motivación al cambio.', ['primera', 'nucleo'], [], false, {
    id: 'etapa-cambio',
    title: 'Etapa de cambio y motivación',
    description: 'Modelo transteórico de Prochaska y DiClemente aplicado al problema objetivo.',
    fields: [
      { id: 'etapa', label: 'Etapa de cambio', type: 'seleccion', options: ['Precontemplación', 'Contemplación', 'Preparación', 'Acción', 'Mantenimiento', 'Recaída'] },
      { id: 'importancia-cambio', label: 'Importancia del cambio', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Nada importante', scaleMaxLabel: 'Muy importante' },
      { id: 'confianza-lograrlo', label: 'Confianza para lograrlo', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Nada de confianza', scaleMaxLabel: 'Total confianza' },
      { id: 'balance-decisional', label: 'Balance decisional (pros / contras)', type: 'texto_largo', helpText: 'Ventajas y desventajas percibidas de cambiar y de no cambiar.' },
    ],
  }),
  // Nota (§2 fuente única): la anamnesis base —historia del problema actual, historia
  // personal y del desarrollo, dinámica familiar y red de apoyo, y hábitos y estilo de
  // vida— se PREGUNTA POR DEFECTO en el núcleo "Historia general (adultos)" (y en los
  // modelos que se componen sobre él), así que NO se ofrece aquí como bloque añadible
  // para no duplicar. Ver builtinTemplates.ts → builtin-historia-general.
  // ===================== Técnica =====================
  block('Técnica', 'Plan de seguridad colaborativo (modelo Stanley-Brown) para crisis e ideación suicida.', ['primera', 'sesion', 'nucleo'], [], false, {
    id: 'plan-seguridad',
    title: 'Plan de seguridad',
    description: 'Plan de seguridad colaborativo (modelo Stanley-Brown) para momentos de crisis o ideación suicida.',
    fields: [
      { id: 'senales-alerta', label: 'Señales de alerta personales', type: 'texto_largo', helpText: 'Pensamientos, emociones, sensaciones o conductas que anticipan la crisis.' },
      { id: 'estrategias-afrontamiento', label: 'Estrategias de afrontamiento propias', type: 'texto_largo', helpText: 'Cosas que el paciente puede hacer solo para calmarse o distraerse.' },
      { id: 'personas-lugares-distraen', label: 'Personas y lugares que distraen o apoyan', type: 'texto_largo', helpText: 'Contextos sociales que ayudan a salir del foco de la crisis.' },
      { id: 'contactos-apoyo', label: 'Contactos de apoyo (personas)', type: 'texto_largo', helpText: 'Nombre y forma de contacto de familiares o personas de confianza.' },
      { id: 'profesionales-lineas-crisis', label: 'Profesionales y líneas de crisis', type: 'texto_largo', helpText: 'Terapeuta, servicios de emergencia y líneas de ayuda con sus números.' },
      { id: 'restriccion-medios-letales', label: 'Restricción del acceso a medios letales', type: 'texto_largo', helpText: 'Acuerdos para limitar el acceso a medicamentos, armas u otros medios.' },
    ],
  }),
  block('Técnica', 'Análisis funcional de la conducta problema (antecedentes-conducta-consecuencias).', ['primera', 'sesion', 'nucleo'], ['tcc', 'trec', 'activacion-conductual'], true, {
    id: 'analisis-funcional-abc',
    title: 'Análisis funcional (A-B-C)',
    description: 'Análisis funcional de la conducta problema: antecedentes, conducta y consecuencias.',
    fields: [
      { id: 'antecedentes', label: 'Antecedentes / disparadores', type: 'texto_largo', helpText: 'Situación, contexto y estímulos previos a la conducta.' },
      { id: 'conducta', label: 'Conducta (descripción operacional)', type: 'texto_largo', helpText: 'Qué hace exactamente la persona, en términos observables y medibles.' },
      { id: 'consecuencias', label: 'Consecuencias a corto y largo plazo', type: 'texto_largo', helpText: 'Efectos inmediatos y diferidos de la conducta.' },
      { id: 'factores-mantenedores', label: 'Factores que mantienen el problema', type: 'texto_largo', helpText: 'Refuerzos, evitaciones u otros mecanismos que perpetúan la conducta.' },
    ],
  }),
  block('Técnica', 'Registro para identificar y reestructurar pensamientos automáticos.', ['sesion', 'nucleo'], ['tcc', 'trec'], false, {
    id: 'registro-pensamientos',
    title: 'Registro de pensamientos automáticos',
    description: 'Registro para identificar y reestructurar pensamientos automáticos en una situación concreta.',
    fields: [
      { id: 'situacion', label: 'Situación', type: 'texto_largo', helpText: 'Dónde, cuándo y qué ocurría en el momento del malestar.' },
      { id: 'pensamientos-automaticos', label: 'Pensamiento(s) automático(s)', type: 'texto_largo', helpText: 'Lo que pasó por la mente justo antes o durante la emoción.' },
      { id: 'emocion-intensidad', label: 'Emoción y su intensidad', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Nada intensa', scaleMaxLabel: 'Máxima intensidad', helpText: 'Nombra la emoción principal y califica su intensidad.' },
      { id: 'evidencia-favor-contra', label: 'Evidencia a favor y en contra', type: 'texto_largo', helpText: 'Hechos que apoyan y hechos que contradicen el pensamiento.' },
      { id: 'pensamiento-alternativo', label: 'Pensamiento alternativo más equilibrado', type: 'texto_largo', helpText: 'Una interpretación más realista y útil de la situación.' },
    ],
  }),
  block('Técnica', 'Identificación de distorsiones cognitivas en el discurso del paciente.', ['sesion', 'nucleo'], ['tcc', 'trec'], false, {
    id: 'distorsiones-cognitivas',
    title: 'Distorsiones cognitivas',
    description: 'Identificación de distorsiones cognitivas presentes en el discurso del paciente.',
    fields: [
      { id: 'distorsiones-identificadas', label: 'Distorsiones identificadas', type: 'casillas', options: ['Pensamiento dicotómico', 'Sobregeneralización', 'Catastrofización', 'Lectura de mente', 'Personalización', 'Filtro mental', 'Descalificar lo positivo', 'Razonamiento emocional', 'Deberías', 'Etiquetado'], allowsOther: true },
      { id: 'ejemplos-paciente', label: 'Ejemplos concretos del paciente', type: 'texto_largo', helpText: 'Frases o situaciones que ilustran cada distorsión marcada.' },
      { id: 'distorsion-foco', label: 'Distorsión foco de trabajo', type: 'texto_corto', helpText: 'Distorsión prioritaria a trabajar en las próximas sesiones.' },
    ],
  }),
  block('Técnica', 'Conceptualización de creencias intermedias y nucleares (modelo cognitivo).', ['nucleo', 'sesion'], ['tcc'], false, {
    id: 'creencias-intermedias-nucleares',
    title: 'Creencias intermedias y nucleares',
    description: 'Conceptualización de creencias intermedias y nucleares según el modelo cognitivo.',
    fields: [
      { id: 'reglas-supuestos', label: 'Reglas y supuestos (creencias intermedias)', type: 'texto_largo', helpText: 'Reglas, actitudes y supuestos condicionales ("Si… entonces…").' },
      { id: 'creencias-nucleares', label: 'Creencias nucleares hipotetizadas', type: 'texto_largo', helpText: 'Creencias centrales sobre sí mismo, los demás y el mundo.' },
      { id: 'origen-aprendizaje', label: 'Origen / aprendizaje', type: 'texto_largo', helpText: 'Experiencias tempranas o vivencias que originaron estas creencias.' },
      { id: 'evidencia-desconfirma', label: 'Evidencia que las desconfirma', type: 'texto_largo', helpText: 'Datos y experiencias que contradicen la creencia nuclear.' },
    ],
  }),
  block('Técnica', 'Debate de creencias irracionales según el modelo ABC-DE de la TREC.', ['sesion', 'nucleo'], ['trec', 'tcc'], false, {
    id: 'debate-creencias',
    title: 'Debate de creencias irracionales (ABC-DE)',
    description: 'Debate de creencias irracionales según el modelo ABC-DE de la TREC (Ellis).',
    fields: [
      { id: 'creencia-irracional', label: 'Creencia irracional a debatir', type: 'texto_largo', helpText: 'Creencia rígida o exigente que genera malestar.' },
      { id: 'debate-empirico', label: 'Debate empírico (evidencia)', type: 'texto_largo', helpText: '¿Hay evidencia real que sostenga esta creencia?' },
      { id: 'debate-logico', label: 'Debate lógico', type: 'texto_largo', helpText: '¿Se sigue lógicamente? ¿Es coherente el razonamiento?' },
      { id: 'debate-pragmatico', label: 'Debate pragmático (utilidad)', type: 'texto_largo', helpText: '¿De qué le sirve mantener esta creencia?' },
      { id: 'efecto-nueva-filosofia', label: 'Efecto / nueva filosofía (creencia racional alternativa)', type: 'texto_largo', helpText: 'Creencia racional y preferencial que sustituye a la irracional.' },
    ],
  }),
  block('Técnica', 'Jerarquía de situaciones temidas para el trabajo de exposición.', ['primera', 'sesion', 'nucleo'], ['tcc', 'act'], true, {
    id: 'jerarquia-exposicion',
    title: 'Jerarquía de exposición',
    description: 'Jerarquía de situaciones temidas para el trabajo de exposición.',
    fields: [
      { id: 'lista-jerarquica', label: 'Lista jerárquica de situaciones (SUDs esperado)', type: 'texto_largo', helpText: 'Ordena las situaciones de menor a mayor, con el SUDs esperado (0-100) de cada una.' },
      { id: 'item-actual', label: 'Ítem que se trabaja ahora', type: 'texto_corto', helpText: 'Situación de la jerarquía abordada en esta etapa.' },
      { id: 'tipo-exposicion', label: 'Tipo de exposición', type: 'seleccion', options: ['En vivo', 'Imaginaria', 'Interoceptiva', 'Realidad virtual'] },
      { id: 'evitacion-seguridad', label: 'Conductas de evitación y de seguridad a eliminar', type: 'texto_largo', helpText: 'Conductas que reducen la ansiedad a corto plazo y mantienen el miedo.' },
    ],
  }),
  block('Técnica', 'Programación de actividades y registro de su efecto en el ánimo.', ['sesion', 'nucleo'], ['activacion-conductual', 'tcc'], true, {
    id: 'activacion-programacion',
    title: 'Activación conductual / programación de actividades',
    description: 'Programación de actividades para activación conductual y registro de su efecto en el ánimo.',
    fields: [
      { id: 'actividad', label: 'Actividad programada', type: 'texto_corto', helpText: 'Actividad concreta a realizar.' },
      { id: 'area-valor', label: 'Área / valor asociado', type: 'texto_corto', helpText: 'Dominio vital o valor que la actividad conecta.' },
      { id: 'tipo-actividad', label: 'Tipo', type: 'seleccion', options: ['Placer', 'Dominio-logro', 'Ambos', 'Rutina-autocuidado'] },
      { id: 'programacion', label: 'Programación (día, hora, con quién)', type: 'texto_corto', helpText: 'Cuándo y con quién se realizará la actividad.' },
      { id: 'registro-realizacion-animo', label: 'Registro de realización y ánimo', type: 'texto_largo', helpText: '¿Se realizó? Nivel de placer/dominio y ánimo antes y después (0-10).' },
    ],
  }),
  block('Técnica', 'Registro de habilidades DBT enseñadas y su práctica entre sesiones.', ['sesion', 'nucleo'], ['dbt'], true, {
    id: 'habilidades-dbt',
    title: 'Habilidades DBT (por módulo)',
    description: 'Registro de habilidades DBT enseñadas y su práctica entre sesiones.',
    fields: [
      { id: 'modulo', label: 'Módulo', type: 'seleccion', options: ['Mindfulness', 'Tolerancia al malestar', 'Regulación emocional', 'Efectividad interpersonal'] },
      { id: 'habilidad-ensenada', label: 'Habilidad específica enseñada', type: 'texto_corto', helpText: 'Habilidad concreta del módulo (p. ej. TIP, ACEPTAR, DEAR MAN).' },
      { id: 'practica-acordada', label: 'Práctica acordada', type: 'texto_largo', helpText: 'Cómo, cuándo y en qué situaciones la practicará.' },
      { id: 'obstaculos-generalizacion', label: 'Obstáculos para la generalización', type: 'texto_largo', helpText: 'Barreras para aplicar la habilidad en la vida diaria.' },
    ],
  }),
  block('Técnica', 'Análisis en cadena de una conducta problema (DBT).', ['sesion', 'nucleo'], ['dbt'], false, {
    id: 'analisis-cadena',
    title: 'Análisis en cadena (DBT)',
    description: 'Análisis en cadena de una conducta problema según el modelo DBT.',
    fields: [
      { id: 'vulnerabilidades', label: 'Vulnerabilidades del día', type: 'texto_largo', helpText: 'Factores que aumentaron la sensibilidad (sueño, sustancias, conflictos, etc.).' },
      { id: 'evento-disparador', label: 'Evento disparador', type: 'texto_largo', helpText: 'Suceso ambiental que inició la cadena.' },
      { id: 'eslabones-cadena', label: 'Eslabones de la cadena', type: 'texto_largo', helpText: 'Secuencia de pensamientos, emociones, sensaciones y acciones.' },
      { id: 'conducta-problema', label: 'Conducta problema', type: 'texto_largo', helpText: 'Descripción operacional de la conducta objetivo.' },
      { id: 'consecuencias-inmediatas-demoradas', label: 'Consecuencias inmediatas y demoradas', type: 'texto_largo', helpText: 'Qué reforzó la conducta y qué costos trajo después.' },
      { id: 'soluciones-conductas-habiles', label: 'Soluciones y conductas hábiles alternativas', type: 'texto_largo', helpText: 'Puntos de la cadena donde aplicar habilidades distintas.' },
    ],
  }),
  block('Técnica', 'Trabajo de valores, acción comprometida y defusión cognitiva (ACT).', ['sesion', 'nucleo'], ['act'], false, {
    id: 'valores-defusion-act',
    title: 'Valores y defusión (ACT)',
    description: 'Trabajo de valores, acción comprometida y defusión cognitiva desde ACT.',
    fields: [
      { id: 'valores-dominio', label: 'Valores priorizados por dominio vital', type: 'texto_largo', helpText: 'Valores en áreas como pareja, familia, trabajo, salud, ocio.' },
      { id: 'accion-comprometida', label: 'Acción comprometida acordada', type: 'texto_largo', helpText: 'Paso concreto y observable alineado con un valor.' },
      { id: 'tecnica-defusion', label: 'Técnica de defusión practicada', type: 'texto_corto', helpText: 'P. ej. "gracias mente", hojas en el río, repetición de palabra.' },
      { id: 'barreras-internas', label: 'Barreras internas (fusión / evitación)', type: 'texto_largo', helpText: 'Fusión con pensamientos o evitación experiencial que estorban la acción.' },
    ],
  }),
  block('Técnica', 'Registro de un trabajo experiencial de silla vacía o dos sillas.', ['sesion', 'nucleo'], ['gestalt', 'humanista'], false, {
    id: 'silla-vacia',
    title: 'Silla vacía / dos sillas',
    description: 'Registro de un trabajo experiencial de silla vacía o dos sillas (Gestalt / EFT).',
    fields: [
      { id: 'configuracion', label: 'Configuración', type: 'seleccion', options: ['Silla vacía (otro significativo)', 'Dos sillas (polaridades)', 'Dos sillas (autocrítica)'] },
      { id: 'tema-polaridad', label: 'Tema o polaridad trabajada', type: 'texto_largo', helpText: 'Asunto inconcluso, vínculo o polaridad interna abordada.' },
      { id: 'proceso-sesion', label: 'Proceso observado en sesión', type: 'texto_largo', helpText: 'Emociones, cambios de contacto y movimientos durante el ejercicio.' },
      { id: 'cierre-integracion', label: 'Cierre e integración', type: 'texto_largo', helpText: 'Insights, acuerdos internos y sentido que el paciente extrae.' },
    ],
  }),
  block('Técnica', 'Futuro preferido, excepciones y escalas de avance (centrada en soluciones).', ['sesion', 'nucleo'], ['breve-soluciones'], false, {
    id: 'pregunta-milagro-escalas',
    title: 'Pregunta del milagro y escalas',
    description: 'Trabajo centrado en soluciones: futuro preferido, excepciones y escalas de avance.',
    fields: [
      { id: 'respuesta-milagro', label: 'Respuesta a la pregunta del milagro', type: 'texto_largo', helpText: 'Descripción del futuro preferido si el problema se resolviera.' },
      { id: 'excepciones', label: 'Excepciones detectadas', type: 'texto_largo', helpText: 'Momentos en que el problema fue menor o ausente, y qué fue distinto.' },
      { id: 'escala-avance', label: 'Escala de avance hoy', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Lo peor', scaleMaxLabel: 'Milagro cumplido', helpText: 'Dónde se ubica hoy respecto al futuro preferido.' },
      { id: 'senal-punto-mas', label: 'Señal de un punto más', type: 'texto_largo', helpText: 'Siguiente paso pequeño que indicaría avance de un punto.' },
    ],
  }),
  block('Técnica', 'Plan de prevención de recaídas: señales tempranas, riesgos y afrontamiento.', ['sesion', 'nucleo'], [], false, {
    id: 'prevencion-recaidas',
    title: 'Prevención de recaídas',
    description: 'Plan de prevención de recaídas: señales tempranas, riesgos y afrontamiento.',
    fields: [
      { id: 'senales-alerta-tempranas', label: 'Señales de alerta tempranas', type: 'texto_largo', helpText: 'Cambios sutiles en pensamiento, ánimo o conducta que anticipan un retroceso.' },
      { id: 'situaciones-alto-riesgo', label: 'Situaciones de alto riesgo', type: 'texto_largo', helpText: 'Contextos, estados emocionales o personas que aumentan el riesgo.' },
      { id: 'plan-afrontamiento', label: 'Plan de afrontamiento ante cada señal', type: 'texto_largo', helpText: 'Qué hará ante cada señal o situación de riesgo identificada.' },
      { id: 'red-apoyo', label: 'Red de apoyo y a quién acudir', type: 'texto_largo', helpText: 'Personas y recursos a los que recurrir, con su forma de contacto.' },
      { id: 'lapso-vs-recaida', label: 'Distinción lapso vs. recaída', type: 'texto_largo', helpText: 'Cómo diferenciar un desliz puntual de una recaída y cómo reencauzar.' },
    ],
  }),
  // ===================== Proceso =====================
  block('Proceso', 'Seguimiento de las tareas terapéuticas entre sesiones.', ['sesion', 'nucleo'], [], true, {
    id: 'autorregistro-tareas',
    title: 'Autorregistro / tarea entre sesiones',
    description: 'Seguimiento de las tareas terapéuticas asignadas para realizar entre sesiones.',
    fields: [
      { id: 'tarea-asignada', label: 'Tarea asignada', type: 'texto_largo' },
      { id: 'adherencia', label: 'Adherencia', type: 'seleccion', options: ['Completa', 'Parcial', 'No realizada'] },
      { id: 'obstaculos', label: 'Obstáculos', type: 'texto_largo', helpText: 'Barreras que dificultaron o impidieron la realización de la tarea.' },
      { id: 'hallazgos-aprendizajes', label: 'Hallazgos o aprendizajes', type: 'texto_largo' },
      { id: 'siguiente-paso', label: 'Siguiente paso', type: 'texto_largo' },
    ],
  }),
  block('Proceso', 'Lectura dinámica de defensas y de la relación transferencial.', ['nucleo', 'sesion'], ['psicodinamica'], false, {
    id: 'defensas-transferencia',
    title: 'Defensas y transferencia',
    description: 'Lectura dinámica de los mecanismos de defensa y de la relación transferencial-contratransferencial.',
    fields: [
      { id: 'mecanismos-defensa', label: 'Mecanismos de defensa predominantes', type: 'casillas', options: ['Represión', 'Negación', 'Proyección', 'Racionalización', 'Intelectualización', 'Escisión', 'Idealización/devaluación', 'Formación reactiva', 'Desplazamiento', 'Sublimación'], allowsOther: true },
      { id: 'transferencia-observada', label: 'Transferencia observada', type: 'texto_largo', helpText: 'Modalidad vincular que el paciente despliega hacia el terapeuta.' },
      { id: 'resonancia-contratransferencial', label: 'Resonancia contratransferencial', type: 'texto_largo', helpText: 'Sensaciones, emociones e impulsos que despierta el paciente en el terapeuta.' },
    ],
  }),
  // ===================== Estructural =====================
  block('Estructural', 'Objetivos terapéuticos formulados con criterios SMART.', ['primera', 'nucleo'], [], false, {
    id: 'objetivos-smart',
    title: 'Objetivos terapéuticos (SMART)',
    description: 'Definición de objetivos terapéuticos según criterios SMART.',
    fields: [
      { id: 'objetivo', label: 'Objetivo', type: 'texto_largo' },
      { id: 'criterios-smart', label: 'Criterios SMART', type: 'texto_largo', helpText: 'Específico, Medible, Alcanzable, Relevante y Temporal.' },
      { id: 'indicador-logro', label: 'Indicador de logro', type: 'texto_largo', helpText: 'Señal observable que confirmará que el objetivo se cumplió.' },
      { id: 'fecha-objetivo', label: 'Fecha objetivo', type: 'fecha' },
    ],
  }),
];

/** Secciones del núcleo por defecto (las de "Historia general (adultos)"). */
export function historiaNucleoSections(): ClinicalSection[] {
  const nucleo = BUILTIN_CLINICAL_TEMPLATES.find((t) => t.id === HISTORIA_NUCLEO_TEMPLATE_ID);
  return nucleo ? nucleo.sections.filter((s) => !EXCLUDED_SECTION_IDS.has(s.id)) : [];
}

/** Catálogo curado completo de bloques añadibles (§4). */
export function historiaBlockCatalog(): HistoriaBlock[] {
  return CURATED_BLOCKS;
}

/**
 * Reescribe los ids de una sección de bloque para garantizar unicidad dentro de
 * la entidad que lo recibe (historia o sesión): la sección toma el id del bloque
 * y cada campo se prefija con `${blockId}::`. Evita colisiones de respuestas
 * entre secciones de distintas plantillas. Fuente ÚNICA del namespacing de
 * bloques (§10), compartida por AddHistoriaBlock y AddSessionBlock.
 */
export function namespaceBlockSection(blockId: string, section: ClinicalSection): ClinicalSection {
  return {
    ...section,
    id: blockId,
    fields: section.fields.map((field) => ({ ...field, id: `${blockId}::${field.id}` })),
  };
}

/** Categorías presentes en el catálogo (orden canónico). */
export function historiaBlockCategories(): BlockCategory[] {
  const present = new Set(CURATED_BLOCKS.map((block) => block.category));
  return BLOCK_CATEGORIES.filter((category) => present.has(category));
}

/**
 * Busca bloques por contexto (opcional: dónde se añade), categoría (opcional) y
 * texto (en título, descripción y etiquetas de campos). Sin acentos ni mayúsculas.
 * `addableIn` activa el filtro por contexto del catálogo: p. ej. en una sesión de
 * seguimiento solo se ofrecen los bloques con 'sesion' en su `addableIn`.
 */
export function searchHistoriaBlocks(
  query: string,
  category?: string,
  addableIn?: BlockAddableIn,
): HistoriaBlock[] {
  let base = CURATED_BLOCKS;
  if (addableIn) base = base.filter((block) => block.addableIn.includes(addableIn));
  if (category && category.trim()) base = base.filter((block) => block.category === category);
  const q = normalize(query.trim());
  if (!q) return base;
  return base.filter((block) => {
    const haystack = normalize(
      `${block.category} ${block.title} ${block.description} ${block.section.fields
        .map((field) => field.label)
        .join(' ')}`,
    );
    return haystack.includes(q);
  });
}

// ============================ Migración de IDs (§10) ============================
//
// La v1 derivaba bloques con id `${templateId}:${sectionId}` (p. ej.
// `builtin-tcc:analisis-funcional`). El catálogo curado usa ids `bloque:<kebab>`.
// Las historias ya guardadas llevan las secciones añadidas COMO SNAPSHOT (con sus
// propios campos y respuestas), así que siguen renderizando aunque su id quede
// huérfano. Esta tabla mapea los ids antiguos más probables a su bloque curado
// equivalente; la migración solo cambia el PREFIJO (id de sección + de campos +
// claves de respuesta), preservando el contenido guardado.

const MIGRATED_BLOCK_IDS: Record<string, string> = {
  'builtin-tcc:analisis-funcional': 'bloque:analisis-funcional-abc',
  'builtin-tcc:cogniciones': 'bloque:registro-pensamientos',
  'builtin-familiar:composicion-genograma': 'bloque:genograma',
  'builtin-psicodinamica:funcionamiento-psiquico': 'bloque:defensas-transferencia',
  'builtin-adicciones:etapa-motivacion': 'bloque:etapa-cambio',
};

type RecordAnswers = Record<string, string | string[]>;

/**
 * Remapea, de forma lazy y sin pérdida, las secciones (y sus respuestas) cuyo id
 * de bloque antiguo tenga equivalente curado. Cambia el prefijo del id de la
 * sección, de sus campos (`oldId::campo` → `newId::campo`) y de las claves de
 * respuesta. Las secciones sin mapeo se devuelven intactas.
 */
export function migrateRecordSections(
  sections: ClinicalSection[] | null,
  answers: RecordAnswers,
): { sections: ClinicalSection[] | null; answers: RecordAnswers } {
  if (!sections || sections.length === 0) return { sections, answers };
  let changed = false;
  const migrated = sections.map((section) => {
    const newId = MIGRATED_BLOCK_IDS[section.id];
    if (!newId) return section;
    changed = true;
    const oldPrefix = `${section.id}::`;
    const newPrefix = `${newId}::`;
    return {
      ...section,
      id: newId,
      fields: section.fields.map((field) =>
        field.id.startsWith(oldPrefix)
          ? { ...field, id: `${newPrefix}${field.id.slice(oldPrefix.length)}` }
          : field,
      ),
    };
  });
  if (!changed) return { sections, answers };
  const migratedAnswers: RecordAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    let nextKey = key;
    for (const [oldId, newId] of Object.entries(MIGRATED_BLOCK_IDS)) {
      const oldPrefix = `${oldId}::`;
      if (key.startsWith(oldPrefix)) {
        nextKey = `${newId}::${key.slice(oldPrefix.length)}`;
        break;
      }
    }
    migratedAnswers[nextKey] = value;
  }
  return { sections: migrated, answers: migratedAnswers };
}

/** ¿Todos los `relevantModels` del catálogo son keys de modelo válidas? (uso en tests). */
export function allRelevantModelsAreValid(): boolean {
  return CURATED_BLOCKS.every((block) => block.relevantModels.every((key) => isModelKey(key)));
}
