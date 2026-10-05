import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';

/**
 * Plantillas de SESIÓN estructurada (spec historia clínica §2). Tipos de sesión:
 * "Entrevista inicial" (rica, siembra la historia), "Seguimiento" (ligera), "Nota" (libre,
 * sin formulario base), "Prueba aplicada" (registro global de un test) y "Atención
 * en crisis" (intervención + evaluación de riesgo). Alimentan la Evolución del
 * expediente. La de "Nota" no tiene secciones base (solo texto + bloques). Viven APARTE de
 * `BUILTIN_CLINICAL_TEMPLATES` a propósito: NO deben aparecer en el catálogo de
 * bloques de la historia. Módulo PURO (sin Node): usable en cliente.
 */

export type SessionKind = 'primera' | 'seguimiento' | 'nota' | 'valoracion' | 'crisis';

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  sections: ClinicalSection[];
}

const RIESGO_NIVEL_OPTIONS = ['Sin riesgo', 'Bajo', 'Moderado', 'Alto'];

const PRIMERA_SESION: SessionTemplate = {
  id: 'session-primera',
  name: 'Entrevista inicial',
  description: 'Apertura del caso y toma de historia: motivo, exploración, impresión diagnóstica y plan inicial.',
  sections: [
    {
      id: 'motivo',
      title: 'Motivo de consulta y demanda',
      fields: [
        {
          id: 'motivo',
          label: 'Motivo de consulta (en palabras del consultante)',
          type: 'texto_largo',
          placeholder: '¿Qué lo trae a consulta?',
        },
        { id: 'expectativas', label: 'Expectativas y demanda', type: 'texto_largo' },
      ],
    },
    {
      id: 'exploracion',
      title: 'Exploración del problema',
      fields: [
        {
          id: 'historia-problema',
          label: 'Historia del problema actual (inicio, evolución, desencadenantes)',
          type: 'texto_largo',
        },
        {
          id: 'areas-afectadas',
          label: 'Áreas afectadas',
          type: 'casillas',
          options: ['Ánimo', 'Ansiedad', 'Sueño', 'Apetito', 'Relaciones', 'Trabajo/estudio', 'Autoestima', 'Consumo'],
        },
      ],
    },
    {
      id: 'impresion',
      title: 'Impresión clínica',
      fields: [
        { id: 'observacion', label: 'Observación clínica / examen mental', type: 'texto_largo' },
        {
          id: 'dx-hipotetico',
          label: 'Dx hipotético / impresión diagnóstica (CIE-11 si aplica)',
          type: 'texto_largo',
          helpText: 'La impresión diagnóstica formal se registra en la pestaña Diagnóstico.',
        },
      ],
    },
    {
      id: 'plan-inicial',
      title: 'Plan inicial',
      fields: [
        { id: 'objetivos', label: 'Objetivos terapéuticos iniciales', type: 'texto_largo' },
        { id: 'encuadre', label: 'Encuadre (frecuencia, modalidad)', type: 'texto_corto' },
        { id: 'enfoque', label: 'Enfoque / técnicas propuestas', type: 'texto_corto' },
      ],
    },
    {
      id: 'tareas',
      title: 'Tareas y ejercicios',
      fields: [{ id: 'tareas', label: 'Tareas / ejercicios asignados', type: 'texto_largo' }],
    },
    {
      id: 'riesgo',
      title: 'Riesgo',
      description: 'Valoración de seguridad. Si hay riesgo activo, detalla y define un plan.',
      fields: [
        { id: 'riesgo-nivel', label: 'Nivel de riesgo', type: 'seleccion', options: RIESGO_NIVEL_OPTIONS },
        {
          id: 'riesgo-detalle',
          label: 'Ideación / autolesión / heteroagresión / plan (detallar)',
          type: 'texto_largo',
        },
      ],
    },
  ],
};

const SEGUIMIENTO: SessionTemplate = {
  id: 'session-seguimiento',
  name: 'Seguimiento',
  description: 'Sesión de continuidad: avance, lo trabajado hoy, tareas y plan de la próxima.',
  sections: [
    {
      id: 'llegada',
      title: 'Cómo llega',
      fields: [
        {
          id: 'estado-llegada',
          label: 'Cómo llega / estado y avance desde la última sesión',
          type: 'texto_largo',
        },
      ],
    },
    {
      id: 'trabajo',
      title: 'Trabajo de la sesión',
      fields: [
        { id: 'trabajado', label: 'Qué se trabajó hoy', type: 'texto_largo' },
        {
          id: 'tecnicas',
          label: 'Técnicas aplicadas',
          type: 'casillas',
          options: [
            'Reestructuración cognitiva',
            'Exposición',
            'Activación conductual',
            'Mindfulness',
            'Habilidades DBT',
            'Psicoeducación',
            'Trabajo emocional',
            'Revisión de tareas',
          ],
        },
      ],
    },
    {
      id: 'tareas',
      title: 'Tareas',
      fields: [{ id: 'tareas', label: 'Tareas asignadas para la próxima sesión', type: 'texto_largo' }],
    },
    {
      id: 'plan',
      title: 'Plan',
      fields: [{ id: 'plan-proxima', label: 'Plan / foco de la próxima sesión', type: 'texto_largo' }],
    },
    {
      id: 'riesgo',
      title: 'Riesgo',
      fields: [
        { id: 'riesgo-nivel', label: 'Nivel de riesgo', type: 'seleccion', options: RIESGO_NIVEL_OPTIONS },
        { id: 'riesgo-detalle', label: 'Observaciones de riesgo (si aplica)', type: 'texto_largo' },
      ],
    },
  ],
};

/** Nota libre: sin formulario base (solo texto + bloques opcionales). */
const NOTA: SessionTemplate = {
  id: 'session-nota',
  name: 'Nota',
  description: 'Nota libre: escribe lo que quieras y, si lo necesitas, añade bloques.',
  sections: [],
};

/** Registro GLOBAL de cualquier prueba/test aplicado (antes "Valoración"). */
const PRUEBA_APLICADA: SessionTemplate = {
  id: 'session-valoracion',
  name: 'Prueba aplicada',
  description: 'Registro de una prueba o test aplicado: resultado, consideraciones y notas.',
  sections: [
    {
      id: 'prueba',
      title: 'Prueba aplicada',
      fields: [
        {
          id: 'prueba-aplicada',
          label: 'Prueba aplicada',
          type: 'texto_corto',
          placeholder: 'Nombre del test / instrumento',
        },
        { id: 'fecha-aplicacion', label: 'Fecha de aplicación', type: 'fecha' },
        {
          id: 'resultado',
          label: 'Resultado',
          type: 'texto_largo',
          helpText: 'Puntajes, percentiles o rangos obtenidos.',
        },
        {
          id: 'consideraciones',
          label: 'Consideraciones',
          type: 'texto_largo',
          helpText: 'Interpretación y consideraciones clínicas.',
        },
        { id: 'notas', label: 'Notas', type: 'texto_largo' },
      ],
    },
  ],
};

const ATENCION_CRISIS: SessionTemplate = {
  id: 'session-crisis',
  name: 'Atención en crisis',
  description: 'Intervención en crisis: situación, evaluación de riesgo, contención y plan de seguridad.',
  sections: [
    {
      id: 'situacion-crisis',
      title: 'Situación de crisis',
      fields: [
        { id: 'desencadenante', label: 'Desencadenante / qué ocurrió', type: 'texto_largo' },
        { id: 'descripcion-crisis', label: 'Descripción de la crisis', type: 'texto_largo' },
      ],
    },
    {
      id: 'estado-actual',
      title: 'Estado actual',
      fields: [
        { id: 'estado-emocional', label: 'Estado emocional y mental actual', type: 'texto_largo' },
        {
          id: 'nivel-activacion',
          label: 'Nivel de activación / agitación',
          type: 'escala',
          scaleMin: 0,
          scaleMax: 10,
          scaleMinLabel: 'En calma',
          scaleMaxLabel: 'Activación máxima',
        },
      ],
    },
    {
      id: 'evaluacion-riesgo',
      title: 'Evaluación de riesgo',
      description: 'Valoración de seguridad: ideación, plan, medios y factores. Si hay riesgo agudo, activa el protocolo de crisis.',
      fields: [
        { id: 'riesgo-nivel', label: 'Nivel de riesgo', type: 'seleccion', options: RIESGO_NIVEL_OPTIONS },
        {
          id: 'ideacion-plan-medios',
          label: 'Ideación, plan, intención y acceso a medios',
          type: 'texto_largo',
        },
        {
          id: 'factores-riesgo',
          label: 'Factores de riesgo presentes',
          type: 'casillas',
          options: ['Intento(s) previo(s)', 'Consumo de sustancias', 'Desesperanza', 'Aislamiento', 'Impulsividad', 'Acceso a medios letales', 'Pérdida reciente'],
        },
        {
          id: 'factores-protectores',
          label: 'Factores protectores',
          type: 'casillas',
          options: ['Red de apoyo', 'Vínculo terapéutico', 'Personas a cargo', 'Razones para vivir', 'Buena adherencia al tratamiento'],
        },
      ],
    },
    {
      id: 'intervencion-crisis',
      title: 'Intervención realizada',
      fields: [
        {
          id: 'intervenciones',
          label: 'Intervenciones aplicadas',
          type: 'casillas',
          options: ['Contención emocional', 'Validación', 'Plan de seguridad', 'Regulación / respiración', 'Psicoeducación', 'Activación de red de apoyo', 'Restricción de acceso a medios', 'Derivación a urgencias'],
        },
        { id: 'detalle-intervencion', label: 'Detalle de la intervención', type: 'texto_largo' },
      ],
    },
    {
      id: 'plan-seguridad-seguimiento',
      title: 'Plan de seguridad y seguimiento',
      fields: [
        {
          id: 'plan-seguridad',
          label: 'Plan de seguridad acordado',
          type: 'texto_largo',
          helpText: 'Señales de alerta, estrategias de afrontamiento, contactos de apoyo y líneas de crisis.',
        },
        { id: 'proximo-contacto', label: 'Próximo contacto / seguimiento', type: 'texto_corto' },
        { id: 'derivacion', label: 'Derivación (urgencias, psiquiatría, otros)', type: 'texto_corto' },
      ],
    },
  ],
};

export const SESSION_TEMPLATES: Record<SessionKind, SessionTemplate> = {
  primera: PRIMERA_SESION,
  seguimiento: SEGUIMIENTO,
  nota: NOTA,
  valoracion: PRUEBA_APLICADA,
  crisis: ATENCION_CRISIS,
};

/** Orden de los tipos de sesión para el desplegable "Registrar sesión". */
export const SESSION_KINDS: SessionKind[] = ['primera', 'seguimiento', 'nota', 'valoracion', 'crisis'];

/** Plantilla de sesión para un tipo dado. */
export function sessionTemplateForKind(kind: SessionKind): SessionTemplate {
  return SESSION_TEMPLATES[kind];
}

/** Tipo de sesión a partir del id de su plantilla (null si no es de sesión). */
export function sessionKindForTemplateId(templateId: string | null): SessionKind | null {
  if (templateId === null) return null;
  const entry = (Object.entries(SESSION_TEMPLATES) as [SessionKind, SessionTemplate][]).find(
    ([, template]) => template.id === templateId,
  );
  return entry ? entry[0] : null;
}

const SESSION_KIND_SET = new Set<string>(SESSION_KINDS);

export function isSessionKind(value: unknown): value is SessionKind {
  return typeof value === 'string' && SESSION_KIND_SET.has(value);
}

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  primera: 'Entrevista inicial',
  seguimiento: 'Seguimiento',
  nota: 'Nota',
  valoracion: 'Prueba aplicada',
  crisis: 'Atención en crisis',
};

/** Título por defecto de una nota de sesión recién creada, según su tipo. */
export const DEFAULT_SESSION_TITLE: Record<SessionKind, string> = {
  primera: 'Entrevista inicial',
  seguimiento: 'Sesión de seguimiento',
  nota: 'Nota',
  valoracion: 'Prueba aplicada',
  crisis: 'Atención en crisis',
};
