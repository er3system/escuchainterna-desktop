/**
 * Plantillas de historia clínica integradas (estilo formulario tipo Google Forms).
 * Cada plantilla corresponde a un enfoque/tipo de terapia.
 */

export type ClinicalFieldType =
  | 'texto_corto'
  | 'texto_largo'
  | 'fecha'
  | 'numero'
  | 'seleccion'
  | 'opcion_multiple'
  | 'casillas'
  | 'escala';

export interface ClinicalField {
  id: string;
  label: string;
  type: ClinicalFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  /**
   * Patrón "Otro → ¿cuáles?" (v2 §4): en campos de selección con una opción
   * "Otro/Otra/Otras", al marcarla se despliega un texto opcional de aclaración
   * que se guarda inline en el valor (`"Otras: ketamina"`). Ver `otherOption.ts`.
   */
  allowsOther?: boolean;
}

export interface ClinicalSection {
  id: string;
  title: string;
  description?: string;
  fields: ClinicalField[];
}

export interface BuiltinClinicalTemplate {
  id: string;
  name: string;
  therapyType: string;
  description: string;
  sections: ClinicalSection[];
}

/**
 * Sección final compartida por TODAS las plantillas integradas (v2, spec 6.9):
 * un campo libre para lo que no cabe en el resto del formulario.
 */
export const ADDITIONAL_NOTES_SECTION: ClinicalSection = {
  id: 'notas-adicionales',
  title: 'Notas adicionales',
  description: 'Espacio libre para información que no corresponde a las secciones anteriores.',
  fields: [
    {
      id: 'otros-notas',
      label: 'Otros / Notas adicionales',
      type: 'texto_largo',
      placeholder: 'Cualquier otra observación, acuerdo o dato relevante…',
    },
  ],
};

/**
 * Garantiza que una lista de secciones termine con la sección "Notas
 * adicionales" (sin duplicarla). Útil para plantillas integradas guardadas en
 * BD antes de la v2.
 */
export function ensureAdditionalNotesSection(sections: ClinicalSection[]): ClinicalSection[] {
  if (sections.some((section) => section.id === ADDITIONAL_NOTES_SECTION.id)) return sections;
  return [...sections, ADDITIONAL_NOTES_SECTION];
}

const BASE_BUILTIN_CLINICAL_TEMPLATES: BuiltinClinicalTemplate[] = [
  {
    id: 'builtin-historia-general',
    name: 'Historia clínica general (adultos)',
    therapyType: 'General',
    description: 'Plantilla base para la primera evaluación de pacientes adultos.',
    sections: [
      {
        id: 'identificacion',
        title: 'Ficha de identificación',
        description: 'Datos generales del paciente.',
        fields: [
          { id: 'fecha-evaluacion', label: 'Fecha de la evaluación', type: 'fecha' },
          { id: 'ocupacion', label: 'Ocupación', type: 'texto_corto' },
          { id: 'escolaridad', label: 'Escolaridad', type: 'seleccion', options: ['Primaria', 'Secundaria', 'Preparatoria', 'Licenciatura', 'Posgrado', 'Otra'], allowsOther: true },
          { id: 'estado-civil', label: 'Estado civil', type: 'seleccion', options: ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a'] },
          { id: 'vive-con', label: '¿Con quién vive actualmente?', type: 'texto_corto' },
          { id: 'referido-por', label: 'Referido/a por', type: 'texto_corto' },
        ],
      },
      {
        id: 'motivo',
        title: 'Motivo de consulta',
        fields: [
          { id: 'motivo-paciente', label: 'Motivo de consulta (en palabras del paciente)', type: 'texto_largo', required: true },
          { id: 'intensidad', label: 'Intensidad del malestar actual', type: 'escala', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Leve', scaleMaxLabel: 'Muy intenso' },
          { id: 'tratamientos-previos', label: 'Tratamientos psicológicos o psiquiátricos previos', type: 'texto_largo' },
        ],
      },
      {
        id: 'historia-problema-actual',
        title: 'Historia del problema actual',
        description: 'Desarrollo del motivo de consulta: inicio, curso, factores y repercusión.',
        fields: [
          { id: 'inicio', label: 'Inicio (cuándo y cómo)', type: 'texto_largo', helpText: 'Forma de aparición (súbita o gradual), antigüedad y contexto en que comenzó.' },
          { id: 'evolucion', label: 'Evolución desde el inicio', type: 'texto_largo', helpText: 'Curso en el tiempo: episodios, mejorías, empeoramientos y momentos de mayor intensidad.' },
          { id: 'factores-desencadenantes', label: 'Factores desencadenantes y mantenedores', type: 'texto_largo', helpText: 'Qué lo dispara, qué lo agrava y qué lo perpetúa.' },
          { id: 'areas-afectadas', label: 'Áreas de vida afectadas', type: 'casillas', options: ['Familiar', 'Pareja', 'Social', 'Laboral / académica', 'Salud física', 'Económica', 'Autocuidado', 'Sueño'], allowsOther: true },
          { id: 'impacto-funcionamiento', label: 'Impacto en el funcionamiento diario', type: 'texto_largo', helpText: 'Cómo interfiere el problema en el día a día.' },
          { id: 'intentos-solucion', label: 'Intentos de solución previos', type: 'texto_largo', helpText: 'Qué ha hecho para afrontarlo y con qué resultado.' },
        ],
      },
      {
        id: 'antecedentes',
        title: 'Antecedentes',
        fields: [
          { id: 'antecedentes-medicos', label: 'Antecedentes médicos relevantes', type: 'texto_largo' },
          { id: 'medicacion-actual', label: 'Medicación actual', type: 'texto_largo' },
          { id: 'antecedentes-familiares', label: 'Antecedentes familiares de salud mental', type: 'texto_largo' },
          { id: 'consumo-sustancias', label: 'Consumo de sustancias', type: 'casillas', options: ['Alcohol', 'Tabaco', 'Cannabis', 'Estimulantes', 'Otras', 'Ninguna'], allowsOther: true },
        ],
      },
      {
        id: 'historia-desarrollo',
        title: 'Historia personal y del desarrollo',
        description: 'Recorrido biográfico: desarrollo, etapas vitales y experiencias formativas.',
        fields: [
          { id: 'desarrollo-temprano', label: 'Embarazo, parto y desarrollo temprano', type: 'texto_largo', helpText: 'Hitos del desarrollo si son pertinentes (sobre todo en infanto-juvenil); opcional en adultos.' },
          { id: 'infancia-adolescencia', label: 'Infancia y adolescencia', type: 'texto_largo', helpText: 'Clima familiar, estilo de crianza, vivencias y ajuste en cada etapa.' },
          { id: 'historia-escolar-laboral', label: 'Historia escolar y laboral', type: 'texto_largo', helpText: 'Rendimiento, adaptación, logros y dificultades; trayectoria ocupacional.' },
          { id: 'historia-afectiva', label: 'Historia afectiva y de pareja', type: 'texto_largo', helpText: 'Relaciones significativas, patrón de vínculos, rupturas relevantes.' },
          { id: 'experiencias-significativas', label: 'Experiencias significativas o potencialmente traumáticas', type: 'texto_largo', helpText: 'Registra sin forzar la exploración; respeta el ritmo del paciente en la primera entrevista.' },
          { id: 'historia-psicosexual', label: 'Historia psicosexual (si es pertinente)', type: 'texto_largo', helpText: 'Solo si es relevante para el motivo de consulta y con el consentimiento del paciente.' },
        ],
      },
      {
        id: 'dinamica-familiar-apoyo',
        title: 'Dinámica familiar y red de apoyo',
        description: 'Entorno relacional actual del paciente y apoyos con los que cuenta.',
        fields: [
          { id: 'composicion-hogar', label: 'Composición del hogar / con quién vive', type: 'texto_corto' },
          { id: 'dinamica-familiar', label: 'Dinámica familiar actual', type: 'texto_largo', helpText: 'Roles, comunicación, conflictos, alianzas y apoyos dentro de la familia.' },
          { id: 'relaciones-interpersonales', label: 'Relaciones interpersonales', type: 'texto_largo', helpText: 'Amistades y vínculos sociales: cantidad, calidad y satisfacción.' },
          { id: 'red-apoyo', label: 'Red de apoyo percibida', type: 'seleccion', options: ['Sólida', 'Moderada', 'Escasa', 'Ausente'] },
          { id: 'personas-clave', label: 'Personas clave de apoyo', type: 'texto_largo', helpText: 'A quién acude el paciente en momentos difíciles.' },
        ],
      },
      {
        id: 'habitos-estilo-vida',
        title: 'Hábitos y estilo de vida',
        description: 'Hábitos cotidianos que influyen en el estado clínico y el tratamiento.',
        fields: [
          { id: 'sueno', label: 'Sueño', type: 'texto_largo', helpText: 'Horas, calidad, conciliación y mantenimiento, descanso percibido.' },
          { id: 'alimentacion', label: 'Alimentación', type: 'texto_largo', helpText: 'Patrón, cambios recientes de apetito o peso, relación con la comida.' },
          { id: 'actividad-fisica', label: 'Actividad física / ejercicio', type: 'texto_largo', helpText: 'Tipo y frecuencia de actividad física; sedentarismo.' },
          { id: 'rutina-pantallas', label: 'Rutina diaria y uso de pantallas', type: 'texto_largo', helpText: 'Estructura del día, tiempo frente a pantallas y su impacto.' },
        ],
      },
      {
        id: 'evaluacion',
        title: 'Examen mental y observaciones',
        fields: [
          { id: 'apariencia', label: 'Apariencia y actitud', type: 'texto_largo' },
          { id: 'afecto', label: 'Estado de ánimo y afecto', type: 'texto_largo' },
          { id: 'riesgo', label: 'Indicadores de riesgo (ideación suicida, autolesión, riesgo a terceros)', type: 'texto_largo', helpText: 'Documenta cualquier indicador y el plan de seguridad acordado.' },
        ],
      },
      {
        id: 'plan',
        title: 'Impresión diagnóstica y plan',
        fields: [
          { id: 'impresion', label: 'Impresión diagnóstica inicial', type: 'texto_largo', helpText: 'El diagnóstico formal CIE-11 se registra en la pestaña Diagnóstico.' },
          { id: 'objetivos', label: 'Objetivos terapéuticos iniciales', type: 'texto_largo' },
          { id: 'frecuencia', label: 'Frecuencia de sesiones acordada', type: 'seleccion', options: ['Semanal', 'Quincenal', 'Mensual', 'Por definir'] },
        ],
      },
    ],
  },
  {
    id: 'builtin-tcc',
    name: 'Terapia cognitivo-conductual (TCC)',
    therapyType: 'Cognitivo-conductual',
    description: 'Evaluación inicial con análisis funcional, cogniciones y objetivos operacionalizados.',
    sections: [
      {
        id: 'motivo-conducta',
        title: 'Motivo de consulta y conductas problema',
        fields: [
          { id: 'motivo-consulta', label: 'Motivo de consulta', type: 'texto_largo', required: true },
          { id: 'conductas-problema', label: 'Conductas problema (descripción operacional)', type: 'texto_largo', helpText: 'Describe la conducta en términos observables: qué hace, cuánto dura, en qué contextos.' },
          { id: 'frecuencia-conducta', label: 'Frecuencia de la conducta problema', type: 'seleccion', options: ['Varias veces al día', 'Diaria', 'Varias veces por semana', 'Semanal', 'Ocasional'] },
          { id: 'inicio-problema', label: '¿Desde cuándo ocurre y qué lo desencadenó?', type: 'texto_largo' },
        ],
      },
      {
        id: 'analisis-funcional',
        title: 'Análisis funcional (A-B-C)',
        description: 'Antecedentes, respuesta y consecuencias de la conducta problema.',
        fields: [
          { id: 'antecedentes-situacionales', label: 'Antecedentes: situaciones o estímulos que disparan la conducta', type: 'texto_largo' },
          { id: 'respuesta-triple-sistema', label: 'Respuesta: componentes cognitivo, fisiológico, emocional y motor', type: 'texto_largo' },
          { id: 'consecuencias', label: 'Consecuencias a corto y largo plazo', type: 'texto_largo' },
          { id: 'factores-mantenedores', label: 'Factores que mantienen el problema (refuerzo, evitación)', type: 'texto_largo' },
        ],
      },
      {
        id: 'cogniciones',
        title: 'Pensamientos y esquemas cognitivos',
        fields: [
          { id: 'pensamientos-automaticos', label: 'Pensamientos automáticos típicos', type: 'texto_largo', placeholder: 'Ej. "Voy a fracasar", "Nadie me va a querer"' },
          { id: 'distorsiones-cognitivas', label: 'Distorsiones cognitivas identificadas', type: 'casillas', options: ['Pensamiento dicotómico (todo o nada)', 'Sobregeneralización', 'Catastrofización', 'Lectura de mente', 'Personalización', 'Filtro mental', 'Descalificación de lo positivo', 'Razonamiento emocional', 'Deberías', 'Etiquetado'] },
          { id: 'creencias-intermedias', label: 'Creencias intermedias (reglas, supuestos)', type: 'texto_largo' },
          { id: 'creencias-nucleares', label: 'Creencias nucleares hipotetizadas', type: 'texto_largo' },
        ],
      },
      {
        id: 'medicion-malestar',
        title: 'Medición del malestar y evitación',
        fields: [
          { id: 'suds-actual', label: 'Nivel de malestar subjetivo actual (SUDs)', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Sin malestar', scaleMaxLabel: 'Malestar máximo', helpText: 'Unidades subjetivas de malestar. Útil como línea base para comparar a lo largo del tratamiento.' },
          { id: 'situaciones-mayor-malestar', label: 'Situaciones de mayor malestar (jerarquía inicial)', type: 'texto_largo' },
          { id: 'conductas-evitacion', label: 'Conductas de evitación y de seguridad', type: 'texto_largo' },
          { id: 'acepta-autorregistros', label: '¿Acepta llevar autorregistros entre sesiones?', type: 'opcion_multiple', options: ['Sí', 'No', 'Por definir'] },
        ],
      },
      {
        id: 'objetivos-plan',
        title: 'Objetivos y plan de tratamiento',
        fields: [
          { id: 'objetivos-smart', label: 'Objetivos terapéuticos (formato SMART)', type: 'texto_largo', required: true, helpText: 'Específicos, Medibles, Alcanzables, Relevantes y con Tiempo definido.' },
          { id: 'tecnicas-propuestas', label: 'Técnicas propuestas', type: 'casillas', options: ['Reestructuración cognitiva', 'Exposición gradual', 'Activación conductual', 'Relajación / respiración', 'Entrenamiento en habilidades sociales', 'Resolución de problemas', 'Prevención de respuesta', 'Psicoeducación'] },
          { id: 'sesiones-estimadas', label: 'Número estimado de sesiones', type: 'numero' },
          { id: 'tarea-inicial', label: 'Primera tarea entre sesiones acordada', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-psicodinamica',
    name: 'Psicodinámica / psicoanalítica',
    therapyType: 'Psicodinámica',
    description: 'Historia vincular, funcionamiento psíquico y primeros elementos transferenciales.',
    sections: [
      {
        id: 'motivo-demanda',
        title: 'Motivo de consulta y demanda',
        fields: [
          { id: 'motivo-manifiesto', label: 'Motivo manifiesto (lo que el paciente dice que le trae)', type: 'texto_largo', required: true },
          { id: 'demanda-latente', label: 'Hipótesis sobre la demanda latente', type: 'texto_largo', helpText: 'Qué busca el paciente más allá del síntoma: ser escuchado, validación, cambio, etc.' },
          { id: 'inicio-padecimiento', label: 'Inicio del padecimiento y circunstancias asociadas', type: 'texto_largo' },
          { id: 'analisis-previos', label: 'Procesos terapéuticos o analíticos previos', type: 'texto_largo' },
        ],
      },
      {
        id: 'historia-vincular',
        title: 'Historia familiar y vincular',
        fields: [
          { id: 'familia-origen', label: 'Estructura de la familia de origen', type: 'texto_largo' },
          { id: 'vinculo-materno', label: 'Vínculo con la figura materna', type: 'texto_largo' },
          { id: 'vinculo-paterno', label: 'Vínculo con la figura paterna', type: 'texto_largo' },
          { id: 'perdidas-duelos', label: 'Pérdidas, separaciones y duelos significativos', type: 'texto_largo' },
          { id: 'eventos-traumaticos', label: 'Eventos potencialmente traumáticos', type: 'texto_largo', helpText: 'Registra sin forzar la exploración; respeta el ritmo del paciente en la primera entrevista.' },
        ],
      },
      {
        id: 'funcionamiento-psiquico',
        title: 'Relaciones de objeto y funcionamiento psíquico',
        fields: [
          { id: 'relaciones-objeto', label: 'Relaciones de objeto: patrón vincular predominante', type: 'texto_largo', helpText: 'Cómo se repiten los modos de vincularse en pareja, amistades y trabajo.' },
          { id: 'mecanismos-defensa', label: 'Mecanismos de defensa predominantes', type: 'casillas', options: ['Represión', 'Negación', 'Proyección', 'Racionalización', 'Intelectualización', 'Escisión', 'Idealización / devaluación', 'Formación reactiva', 'Desplazamiento', 'Sublimación'] },
          { id: 'nivel-organizacion', label: 'Nivel de organización de la personalidad (hipótesis)', type: 'seleccion', options: ['Neurótico', 'Limítrofe', 'Psicótico', 'Por determinar'] },
          { id: 'tolerancia-frustracion', label: 'Tolerancia a la frustración y regulación afectiva', type: 'texto_largo' },
        ],
      },
      {
        id: 'material-onirico',
        title: 'Sueños y vida de fantasía',
        fields: [
          { id: 'suenos-recurrentes', label: 'Sueños recurrentes o significativos', type: 'texto_largo' },
          { id: 'pesadillas', label: '¿Presenta pesadillas con frecuencia?', type: 'opcion_multiple', options: ['Sí', 'No', 'Ocasionalmente'] },
          { id: 'fantasias-ensonaciones', label: 'Fantasías y ensoñaciones diurnas relevantes', type: 'texto_largo' },
        ],
      },
      {
        id: 'transferencia-encuadre',
        title: 'Transferencia inicial y encuadre',
        fields: [
          { id: 'transferencia-inicial', label: 'Transferencia inicial observada', type: 'texto_largo', helpText: 'Cómo se posiciona el paciente frente al terapeuta: idealización, desconfianza, seducción, sumisión.' },
          { id: 'contratransferencia', label: 'Resonancia contratransferencial del terapeuta', type: 'texto_largo' },
          { id: 'capacidad-insight', label: 'Capacidad de insight', type: 'escala', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Muy limitada', scaleMaxLabel: 'Muy desarrollada' },
          { id: 'encuadre-acordado', label: 'Encuadre acordado (frecuencia, duración, honorarios, cancelaciones)', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-infantil',
    name: 'Infantil y adolescentes',
    therapyType: 'Infanto-juvenil',
    description: 'Historia evolutiva, escolar y familiar para pacientes menores de edad.',
    sections: [
      {
        id: 'motivo-consulta',
        title: 'Motivo de consulta',
        fields: [
          { id: 'motivo-segun-padres', label: 'Motivo de consulta según los padres o tutores', type: 'texto_largo', required: true },
          { id: 'motivo-segun-nino', label: 'Motivo según el niño/a o adolescente', type: 'texto_largo', helpText: 'Pregunta directamente al menor; su versión suele diferir de la de los adultos y orienta la alianza.' },
          { id: 'inicio-dificultades', label: '¿Desde cuándo se presentan las dificultades?', type: 'texto_corto' },
          { id: 'derivado-por', label: 'Derivado/a por (escuela, pediatra, iniciativa propia)', type: 'texto_corto' },
        ],
      },
      {
        id: 'datos-tutores',
        title: 'Datos de padres o tutores',
        fields: [
          { id: 'nombre-madre', label: 'Nombre, edad y ocupación de la madre', type: 'texto_corto' },
          { id: 'nombre-padre', label: 'Nombre, edad y ocupación del padre', type: 'texto_corto' },
          { id: 'estado-civil-padres', label: 'Situación de los padres', type: 'seleccion', options: ['Casados / unión libre', 'Separados', 'Divorciados', 'Madre soltera', 'Padre soltero', 'Uno o ambos fallecidos', 'Otra'] },
          { id: 'tutor-legal', label: 'Tutor legal y quién autoriza el tratamiento', type: 'texto_corto', helpText: 'Verifica la patria potestad o tutela antes de iniciar, especialmente en padres separados.' },
          { id: 'quien-acude', label: '¿Quién acude a las sesiones de padres?', type: 'casillas', options: ['Madre', 'Padre', 'Ambos', 'Abuelos', 'Otro tutor'] },
        ],
      },
      {
        id: 'desarrollo-evolutivo',
        title: 'Embarazo y desarrollo evolutivo',
        fields: [
          { id: 'embarazo', label: 'Embarazo (planeado, complicaciones, estado emocional de la madre)', type: 'texto_largo' },
          { id: 'tipo-parto', label: 'Tipo de parto', type: 'seleccion', options: ['Vaginal a término', 'Cesárea programada', 'Cesárea de urgencia', 'Parto prematuro', 'No se cuenta con el dato'] },
          { id: 'hitos-desarrollo', label: 'Hitos del desarrollo (sostén cefálico, sedestación, marcha, primeras palabras)', type: 'texto_largo', helpText: 'Anota edades aproximadas y cualquier retraso o regresión observada.' },
          { id: 'control-esfinteres', label: 'Control de esfínteres (edad y dificultades)', type: 'texto_corto' },
          { id: 'enfermedades-infancia', label: 'Enfermedades, hospitalizaciones o accidentes relevantes', type: 'texto_largo' },
        ],
      },
      {
        id: 'historia-escolar',
        title: 'Historia escolar',
        fields: [
          { id: 'grado-actual', label: 'Escuela y grado actual', type: 'texto_corto' },
          { id: 'rendimiento-academico', label: 'Rendimiento académico', type: 'seleccion', options: ['Sobresaliente', 'Bueno', 'Regular', 'Bajo', 'Con materias reprobadas'] },
          { id: 'relacion-companeros', label: 'Relación con compañeros y maestros', type: 'texto_largo' },
          { id: 'apoyos-escolares', label: 'Apoyos escolares recibidos', type: 'casillas', options: ['USAER / apoyo psicopedagógico', 'Adecuaciones curriculares', 'Terapia de lenguaje', 'Maestra sombra', 'Cambio de escuela por dificultades', 'Ninguno'] },
          { id: 'reportes-escuela', label: 'Reportes o señalamientos de la escuela', type: 'texto_largo' },
        ],
      },
      {
        id: 'juego-conducta',
        title: 'Juego, intereses y conducta',
        fields: [
          { id: 'juego-preferido', label: 'Juego preferido y forma de jugar (solo, con otros, simbólico)', type: 'texto_largo' },
          { id: 'intereses-actuales', label: 'Intereses y actividades favoritas', type: 'texto_corto' },
          { id: 'conducta-casa', label: 'Conducta en casa (berrinches, límites, autonomía)', type: 'texto_largo' },
          { id: 'conducta-escuela', label: 'Conducta en la escuela', type: 'texto_largo' },
          { id: 'uso-pantallas', label: 'Uso de pantallas (horas al día y contenido)', type: 'texto_corto' },
          { id: 'sueno-alimentacion', label: 'Sueño y alimentación', type: 'texto_largo' },
        ],
      },
      {
        id: 'dinamica-familiar',
        title: 'Dinámica familiar',
        fields: [
          { id: 'composicion-hogar', label: 'Composición del hogar (quiénes viven con el menor)', type: 'texto_largo' },
          { id: 'relacion-padres', label: 'Relación del menor con cada padre o cuidador', type: 'texto_largo' },
          { id: 'hermanos', label: 'Hermanos (edades y relación entre ellos)', type: 'texto_corto' },
          { id: 'limites-disciplina', label: 'Estilo de crianza, límites y disciplina', type: 'texto_largo' },
          { id: 'eventos-recientes', label: 'Eventos familiares recientes (mudanza, separación, duelo, nacimiento)', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-pareja',
    name: 'Terapia de pareja',
    therapyType: 'Pareja',
    description: 'Primera evaluación conjunta: historia de la relación, conflicto y compromiso con el proceso.',
    sections: [
      {
        id: 'datos-pareja',
        title: 'Datos de ambos miembros',
        fields: [
          { id: 'nombre-miembro-a', label: 'Nombre del miembro A', type: 'texto_corto', required: true },
          { id: 'edad-miembro-a', label: 'Edad del miembro A', type: 'numero' },
          { id: 'ocupacion-miembro-a', label: 'Ocupación del miembro A', type: 'texto_corto' },
          { id: 'nombre-miembro-b', label: 'Nombre del miembro B', type: 'texto_corto', required: true },
          { id: 'edad-miembro-b', label: 'Edad del miembro B', type: 'numero' },
          { id: 'ocupacion-miembro-b', label: 'Ocupación del miembro B', type: 'texto_corto' },
        ],
      },
      {
        id: 'historia-relacion',
        title: 'Historia de la relación',
        fields: [
          { id: 'tiempo-relacion', label: 'Tiempo de relación y de convivencia', type: 'texto_corto' },
          { id: 'linea-tiempo', label: 'Línea de tiempo de la relación', type: 'texto_largo', helpText: 'Hitos: cómo se conocieron, noviazgo, convivencia, matrimonio, hijos, crisis y reconciliaciones.' },
          { id: 'situacion-actual', label: 'Situación actual de la relación', type: 'seleccion', options: ['Noviazgo', 'Unión libre', 'Matrimonio', 'Separados temporalmente', 'En proceso de divorcio'] },
          { id: 'hijos', label: 'Hijos (edades y de qué relación)', type: 'texto_corto' },
          { id: 'relaciones-previas', label: 'Relaciones previas significativas de cada uno', type: 'texto_largo' },
        ],
      },
      {
        id: 'motivo-por-miembro',
        title: 'Motivo de consulta según cada miembro',
        fields: [
          { id: 'motivo-miembro-a', label: 'Motivo según el miembro A', type: 'texto_largo', required: true },
          { id: 'motivo-miembro-b', label: 'Motivo según el miembro B', type: 'texto_largo', required: true },
          { id: 'evento-detonante', label: 'Evento detonante de la consulta', type: 'texto_largo' },
          { id: 'quien-propuso', label: '¿Quién propuso acudir a terapia?', type: 'opcion_multiple', options: ['Miembro A', 'Miembro B', 'Ambos', 'Un tercero (familiar, médico, etc.)'] },
        ],
      },
      {
        id: 'conflicto',
        title: 'Áreas de conflicto',
        fields: [
          { id: 'areas-conflicto', label: 'Áreas de conflicto identificadas', type: 'casillas', options: ['Comunicación', 'Dinero', 'Sexualidad', 'Familia política', 'Crianza', 'Celos', 'Infidelidad', 'Reparto de tareas', 'Tiempo de calidad', 'Proyectos de vida', 'Consumo de sustancias'] },
          { id: 'frecuencia-discusiones', label: 'Frecuencia de las discusiones', type: 'seleccion', options: ['Diaria', 'Varias veces por semana', 'Semanal', 'Quincenal', 'Ocasional'] },
          { id: 'conflicto-tipico', label: 'Descripción de un conflicto típico (cómo inicia, escala y termina)', type: 'texto_largo' },
          { id: 'indicadores-violencia', label: 'Indicadores de violencia en la pareja', type: 'texto_largo', helpText: 'Explora violencia física, psicológica, económica y sexual. Si hay violencia activa, valora si la terapia conjunta está indicada o se requiere atención individual y plan de seguridad.' },
        ],
      },
      {
        id: 'solucion-compromiso',
        title: 'Intentos de solución y compromiso',
        fields: [
          { id: 'intentos-previos', label: 'Intentos previos de solución (qué han hecho y qué resultó)', type: 'texto_largo' },
          { id: 'terapia-pareja-previa', label: '¿Han tomado terapia de pareja antes?', type: 'opcion_multiple', options: ['Sí', 'No'] },
          { id: 'compromiso-miembro-a', label: 'Compromiso del miembro A con el proceso', type: 'escala', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Nulo', scaleMaxLabel: 'Total' },
          { id: 'compromiso-miembro-b', label: 'Compromiso del miembro B con el proceso', type: 'escala', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Nulo', scaleMaxLabel: 'Total' },
          { id: 'expectativas-proceso', label: 'Expectativas de cada uno sobre la terapia', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-familiar',
    name: 'Terapia familiar sistémica',
    therapyType: 'Familiar sistémica',
    description: 'Evaluación del sistema familiar: estructura, ciclo vital, comunicación y recursos.',
    sections: [
      {
        id: 'composicion-genograma',
        title: 'Composición familiar y genograma',
        fields: [
          { id: 'composicion-hogar', label: 'Composición del hogar (miembros, edades, parentesco)', type: 'texto_largo', required: true },
          { id: 'genograma-descriptivo', label: 'Genograma descriptivo', type: 'texto_largo', helpText: 'Describe al menos tres generaciones: relaciones significativas, cortes, conflictos, enfermedades y patrones repetidos.' },
          { id: 'quienes-asisten', label: '¿Quiénes asisten a la sesión?', type: 'texto_corto' },
          { id: 'paciente-identificado', label: 'Paciente identificado (miembro sintomático)', type: 'texto_corto', helpText: 'Quién es señalado por la familia como "el del problema".' },
        ],
      },
      {
        id: 'ciclo-vital-motivo',
        title: 'Ciclo vital y motivo de consulta',
        fields: [
          { id: 'etapa-ciclo-vital', label: 'Etapa del ciclo vital familiar', type: 'seleccion', options: ['Formación de la pareja', 'Familia con hijos pequeños', 'Familia con hijos escolares', 'Familia con adolescentes', 'Salida de los hijos (nido vacío)', 'Familia en etapa tardía'] },
          { id: 'motivo-consulta', label: 'Motivo de consulta', type: 'texto_largo', required: true },
          { id: 'definicion-por-miembro', label: 'Cómo define el problema cada miembro presente', type: 'texto_largo' },
          { id: 'cambios-recientes', label: 'Cambios o crisis recientes (nacimientos, muertes, mudanzas, desempleo)', type: 'texto_largo' },
        ],
      },
      {
        id: 'comunicacion',
        title: 'Patrones de comunicación',
        fields: [
          { id: 'estilo-comunicacion', label: 'Estilo de comunicación predominante', type: 'texto_largo', placeholder: 'Directa, evasiva, agresiva, triangulada...' },
          { id: 'quien-habla-por-quien', label: '¿Quién habla por quién en la sesión?', type: 'texto_corto' },
          { id: 'manejo-conflictos', label: 'Cómo maneja la familia los conflictos y desacuerdos', type: 'texto_largo' },
          { id: 'expresion-afecto', label: 'Expresión de afecto entre los miembros', type: 'escala', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Muy restringida', scaleMaxLabel: 'Muy abierta' },
        ],
      },
      {
        id: 'estructura-familiar',
        title: 'Estructura: alianzas, coaliciones y límites',
        fields: [
          { id: 'alianzas', label: 'Alianzas observadas', type: 'texto_largo', helpText: 'Cercanías entre dos o más miembros que no van en contra de un tercero.' },
          { id: 'coaliciones', label: 'Coaliciones observadas', type: 'texto_largo', helpText: 'Uniones de dos o más miembros en contra de otro (p. ej., madre e hijo contra el padre).' },
          { id: 'jerarquia-limites', label: 'Jerarquía y límites entre subsistemas', type: 'texto_largo', placeholder: 'Claros, difusos o rígidos; quién ejerce la autoridad.' },
          { id: 'roles-familiares', label: 'Roles asignados (cuidador, rebelde, mediador, chivo expiatorio)', type: 'texto_largo' },
        ],
      },
      {
        id: 'soluciones-recursos',
        title: 'Intentos de solución y recursos',
        fields: [
          { id: 'intentos-solucion', label: 'Intentos de solución realizados por la familia', type: 'texto_largo', helpText: 'Considera si las soluciones intentadas forman parte del mantenimiento del problema.' },
          { id: 'ayuda-previa', label: '¿Han recibido ayuda profesional antes?', type: 'opcion_multiple', options: ['Sí', 'No'] },
          { id: 'recursos-familia', label: 'Recursos y fortalezas de la familia', type: 'texto_largo' },
          { id: 'red-apoyo-externa', label: 'Red de apoyo externa', type: 'casillas', options: ['Familia extensa', 'Amistades', 'Comunidad religiosa', 'Escuela', 'Servicios de salud', 'Vecinos / comunidad', 'Otra'] },
          { id: 'disposicion-cambio', label: 'Disposición al cambio del sistema familiar', type: 'escala', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Muy baja', scaleMaxLabel: 'Muy alta' },
        ],
      },
    ],
  },
  {
    id: 'builtin-neuropsicologica',
    name: 'Evaluación neuropsicológica',
    therapyType: 'Neuropsicología',
    description: 'Protocolo de entrevista inicial y registro del proceso de evaluación neuropsicológica.',
    sections: [
      {
        id: 'derivacion',
        title: 'Motivo de derivación',
        fields: [
          { id: 'derivado-por', label: 'Derivado/a por (especialidad e institución)', type: 'texto_corto' },
          { id: 'motivo-derivacion', label: 'Motivo de derivación', type: 'texto_largo', required: true },
          { id: 'pregunta-clinica', label: 'Pregunta clínica a responder', type: 'texto_largo', helpText: 'Qué se espera de la evaluación: diagnóstico diferencial, línea base, valoración prequirúrgica, dictamen, etc.' },
          { id: 'estudios-previos', label: 'Estudios previos (TAC, resonancia, EEG, evaluaciones anteriores)', type: 'texto_largo' },
        ],
      },
      {
        id: 'historia-medica',
        title: 'Historia médica y neurológica',
        fields: [
          { id: 'antecedentes-neurologicos', label: 'Antecedentes neurológicos (TCE, EVC, epilepsia, infecciones del SNC)', type: 'texto_largo' },
          { id: 'perdida-conciencia', label: '¿Ha presentado pérdida de conciencia?', type: 'opcion_multiple', options: ['Sí', 'No', 'No determinado'], helpText: 'Si la respuesta es sí, documenta duración y circunstancias.' },
          { id: 'enfermedades-sistemicas', label: 'Enfermedades sistémicas (diabetes, hipertensión, tiroides)', type: 'texto_largo' },
          { id: 'medicacion-actual', label: 'Medicación actual y dosis', type: 'texto_largo' },
          { id: 'antecedentes-familiares', label: 'Antecedentes familiares neurológicos o psiquiátricos', type: 'texto_largo' },
        ],
      },
      {
        id: 'perfil-paciente',
        title: 'Perfil premórbido del paciente',
        fields: [
          { id: 'anios-escolaridad', label: 'Años de escolaridad formal', type: 'numero' },
          { id: 'lateralidad', label: 'Lateralidad', type: 'seleccion', options: ['Diestra', 'Zurda', 'Ambidiestra', 'Zurdería contrariada'] },
          { id: 'idioma-dominante', label: 'Idioma dominante y otros idiomas', type: 'texto_corto' },
          { id: 'quejas-cognitivas', label: 'Quejas cognitivas del paciente y del informante', type: 'texto_largo', helpText: 'Registra ambas versiones; la discrepancia entre ellas es clínicamente relevante.' },
          { id: 'estado-animo', label: 'Estado de ánimo actual y cambios conductuales recientes', type: 'texto_largo' },
        ],
      },
      {
        id: 'areas-instrumentos',
        title: 'Áreas a evaluar e instrumentos',
        fields: [
          { id: 'areas-evaluar', label: 'Áreas a evaluar', type: 'casillas', required: true, options: ['Atención', 'Memoria', 'Funciones ejecutivas', 'Lenguaje', 'Praxias', 'Gnosias', 'Velocidad de procesamiento', 'Habilidades visoespaciales', 'Cognición social'] },
          { id: 'instrumentos-aplicados', label: 'Instrumentos aplicados (pruebas y versiones)', type: 'texto_largo' },
          { id: 'numero-sesiones-evaluacion', label: 'Número de sesiones de evaluación', type: 'numero' },
          { id: 'fecha-inicio-evaluacion', label: 'Fecha de inicio de la evaluación', type: 'fecha' },
        ],
      },
      {
        id: 'observaciones-conductuales',
        title: 'Observaciones conductuales durante la evaluación',
        fields: [
          { id: 'nivel-alerta', label: 'Nivel de alerta', type: 'seleccion', options: ['Alerta', 'Somnoliento', 'Fluctuante'] },
          { id: 'cooperacion', label: 'Cooperación con las tareas', type: 'escala', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Nula', scaleMaxLabel: 'Óptima' },
          { id: 'fatiga-tolerancia', label: 'Fatiga y tolerancia al esfuerzo', type: 'texto_largo' },
          { id: 'validez-resultados', label: 'Validez estimada de los resultados', type: 'texto_largo', helpText: 'Considera esfuerzo, comprensión de consignas, ansiedad de ejecución y factores sensoriales que pudieran afectar el rendimiento.' },
          { id: 'observaciones-generales', label: 'Otras observaciones conductuales', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-adicciones',
    name: 'Adicciones',
    therapyType: 'Adicciones',
    description: 'Evaluación de consumo de sustancias o conductas adictivas, severidad y etapa de cambio.',
    sections: [
      {
        id: 'sustancias-patron',
        title: 'Sustancias o conductas y patrón de consumo',
        fields: [
          { id: 'sustancias-conductas', label: 'Sustancia(s) o conducta(s) problema', type: 'casillas', required: true, options: ['Alcohol', 'Tabaco / nicotina', 'Cannabis', 'Cocaína', 'Metanfetaminas', 'Opioides', 'Benzodiacepinas', 'Inhalables', 'Juego / apuestas', 'Videojuegos / internet', 'Otra'] },
          { id: 'sustancia-principal', label: 'Sustancia o conducta principal', type: 'texto_corto' },
          { id: 'edad-inicio', label: 'Edad de inicio del consumo', type: 'numero' },
          { id: 'patron-actual', label: 'Patrón de consumo actual (frecuencia, cantidad, vía de administración)', type: 'texto_largo', required: true },
          { id: 'ultimo-consumo', label: 'Fecha del último consumo', type: 'fecha' },
        ],
      },
      {
        id: 'severidad',
        title: 'Criterios de severidad y consecuencias',
        fields: [
          { id: 'criterios-severidad', label: 'Criterios de trastorno por consumo presentes (últimos 12 meses)', type: 'casillas', options: ['Consumo en mayor cantidad o tiempo del previsto', 'Deseo persistente o intentos fallidos de reducir', 'Mucho tiempo invertido en conseguir, consumir o recuperarse', 'Craving (deseo intenso de consumir)', 'Incumplimiento de obligaciones', 'Problemas interpersonales por el consumo', 'Abandono de actividades importantes', 'Consumo en situaciones de riesgo físico', 'Consumo pese a problemas físicos o psicológicos', 'Tolerancia', 'Síndrome de abstinencia'], helpText: 'Orientación DSM-5: 2-3 criterios = leve, 4-5 = moderado, 6 o más = severo.' },
          { id: 'sindrome-abstinencia', label: 'Síntomas de abstinencia experimentados', type: 'texto_largo' },
          { id: 'consecuencias', label: 'Consecuencias del consumo (salud, familia, trabajo, legales, económicas)', type: 'texto_largo' },
          { id: 'consumo-en-hogar', label: '¿Otras personas del hogar consumen?', type: 'texto_corto' },
        ],
      },
      {
        id: 'etapa-motivacion',
        title: 'Etapa de cambio y motivación',
        fields: [
          { id: 'etapa-cambio', label: 'Etapa de cambio (Prochaska y DiClemente)', type: 'seleccion', required: true, options: ['Precontemplación', 'Contemplación', 'Preparación', 'Acción', 'Mantenimiento', 'Recaída'] },
          { id: 'motivacion-cambio', label: 'Motivación actual para el cambio', type: 'escala', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Nula', scaleMaxLabel: 'Muy alta' },
          { id: 'razon-busca-ayuda', label: '¿Por qué busca ayuda en este momento?', type: 'texto_largo' },
          { id: 'presion-externa', label: 'Presión externa para tratarse', type: 'casillas', options: ['Familia', 'Pareja', 'Laboral / escolar', 'Legal', 'Médica', 'Ninguna'] },
        ],
      },
      {
        id: 'intentos-previos',
        title: 'Intentos previos de abstinencia',
        fields: [
          { id: 'intentos-abstinencia', label: 'Intentos previos de abstinencia o reducción', type: 'texto_largo' },
          { id: 'periodo-maximo', label: 'Periodo máximo de abstinencia logrado', type: 'texto_corto' },
          { id: 'tratamientos-previos', label: 'Tratamientos previos (grupos de ayuda mutua, internamiento, terapia, sustitución)', type: 'texto_largo' },
          { id: 'factores-recaida', label: 'Factores asociados a recaídas anteriores', type: 'texto_largo' },
        ],
      },
      {
        id: 'apoyo-riesgo',
        title: 'Red de apoyo y situaciones de riesgo',
        fields: [
          { id: 'red-apoyo', label: 'Red de apoyo disponible (quiénes y qué tan involucrados)', type: 'texto_largo' },
          { id: 'situaciones-riesgo', label: 'Situaciones de riesgo y disparadores de consumo', type: 'texto_largo', helpText: 'Personas, lugares, emociones y horarios asociados al consumo. Base para el plan de prevención de recaídas.' },
          { id: 'riesgo-agudo', label: 'Riesgo agudo (sobredosis, abstinencia complicada, ideación suicida)', type: 'texto_largo', helpText: 'La abstinencia de alcohol y benzodiacepinas puede requerir manejo médico. Deriva a valoración médica si hay riesgo.' },
          { id: 'plan-inicial', label: 'Plan inicial acordado', type: 'texto_largo' },
        ],
      },
    ],
  },
  {
    id: 'builtin-triaje',
    name: 'Primera entrevista breve (triaje)',
    therapyType: 'Triaje',
    description: 'Formato corto para primer contacto: motivo, riesgo, expectativas y decisión de admisión o derivación.',
    sections: [
      {
        id: 'contacto-motivo',
        title: 'Contacto y motivo',
        fields: [
          { id: 'fecha-contacto', label: 'Fecha del primer contacto', type: 'fecha' },
          { id: 'via-contacto', label: 'Vía de contacto', type: 'seleccion', options: ['Teléfono', 'Videollamada', 'Presencial', 'Mensaje / correo'] },
          { id: 'motivo-breve', label: 'Motivo de consulta (resumen breve)', type: 'texto_largo', required: true },
          { id: 'referido-por', label: 'Referido/a por', type: 'texto_corto' },
        ],
      },
      {
        id: 'urgencia-riesgo',
        title: 'Urgencia y riesgo',
        fields: [
          { id: 'nivel-urgencia', label: 'Nivel de urgencia percibido', type: 'escala', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Puede esperar', scaleMaxLabel: 'Atención inmediata', helpText: 'Considera severidad de síntomas, deterioro funcional y riesgo. Un nivel 4-5 amerita respuesta el mismo día.' },
          { id: 'indicadores-riesgo', label: 'Indicadores de riesgo detectados', type: 'texto_largo', required: true, helpText: 'Explora directamente ideación suicida, autolesiones, riesgo a terceros y violencia. Si hay riesgo agudo, activa el protocolo de crisis y deriva a urgencias.' },
          { id: 'atencion-previa', label: '¿Ha recibido atención psicológica o psiquiátrica antes?', type: 'opcion_multiple', options: ['Sí', 'No'] },
          { id: 'apoyo-inmediato', label: 'Apoyo inmediato disponible (con quién vive o puede contactar)', type: 'texto_corto' },
        ],
      },
      {
        id: 'expectativas-disponibilidad',
        title: 'Expectativas y disponibilidad',
        fields: [
          { id: 'expectativas-paciente', label: 'Expectativas del paciente sobre la atención', type: 'texto_largo' },
          { id: 'disponibilidad-horaria', label: 'Disponibilidad horaria', type: 'casillas', options: ['Mañana', 'Tarde', 'Noche', 'Fin de semana'] },
          { id: 'modalidad-preferida', label: 'Modalidad preferida', type: 'opcion_multiple', options: ['Presencial', 'En línea', 'Indistinto'] },
        ],
      },
      {
        id: 'resolucion',
        title: 'Resolución del triaje',
        fields: [
          { id: 'decision-triaje', label: 'Decisión', type: 'seleccion', required: true, options: ['Admisión a tratamiento', 'Lista de espera', 'Derivación externa', 'Derivación a urgencias', 'No requiere atención por el momento'] },
          { id: 'derivar-a', label: 'En caso de derivación, ¿a quién o a qué servicio?', type: 'texto_corto' },
          { id: 'proxima-accion', label: 'Próxima acción acordada con el paciente', type: 'texto_largo' },
          { id: 'fecha-primera-sesion', label: 'Fecha tentativa de primera sesión', type: 'fecha' },
        ],
      },
    ],
  },
  {
    id: 'builtin-trec',
    name: 'TREC / Modelo ABC (Ellis)',
    therapyType: 'Racional emotiva (TREC)',
    description: 'Mapea el malestar con el modelo ABC de Ellis: detecta creencias irracionales y las somete a debate y reestructuración.',
    sections: [
      {
        id: 'acontecimiento-activador',
        title: 'A · Acontecimiento activador',
        description: 'Episodio específico y reciente que pone en marcha la secuencia. Identifica el aspecto más perturbador (A crítica), no la situación global.',
        fields: [
          { id: 'descripcion-episodio', label: 'Episodio concreto (la última vez que ocurrió)', type: 'texto_largo', helpText: 'Un hecho específico y reciente, no generalidades.' },
          { id: 'a-critica', label: 'A crítica (el aspecto más perturbador)', type: 'texto_largo', helpText: 'El detalle que más activó el malestar, p. ej. "la mirada de los demás", no el hecho global.' },
          { id: 'tipo-activador', label: 'Tipo de acontecimiento activador', type: 'seleccion', options: ['Hecho objetivo externo', 'Inferencia sobre el hecho', 'Evento privado (recuerdo, sensación)', 'Emoción o pensamiento previo', 'Anticipación de un evento futuro'], allowsOther: true },
          { id: 'a-modificable', label: '¿El acontecimiento (A) es modificable en la práctica?', type: 'seleccion', options: ['Sí, conviene también actuar sobre A', 'Parcialmente modificable', 'No es modificable', 'Por determinar'] },
        ],
      },
      {
        id: 'consecuencias-emocionales-conductuales',
        title: 'C · Consecuencias',
        description: 'Respuestas emocionales, conductuales y fisiológicas derivadas de A y B. Precisa la emoción distinguiendo su versión sana de la perturbada.',
        fields: [
          { id: 'emocion-predominante', label: 'Emoción perturbada predominante', type: 'seleccion', options: ['Ansiedad / pánico', 'Depresión con autodesvalorización', 'Ira / hostilidad destructiva', 'Culpa con autocondena', 'Vergüenza invalidante', 'Baja tolerancia a la frustración'], allowsOther: true },
          { id: 'emocion-sana-objetivo', label: 'Emoción negativa sana como objetivo', type: 'seleccion', options: ['Preocupación / inquietud funcional', 'Tristeza / duelo', 'Disgusto / molestia asertiva', 'Remordimiento orientado a reparar', 'Decepción consigo mismo', 'Frustración tolerable'], allowsOther: true, helpText: 'Versión proporcionada que moviliza recursos, no la ausencia de emoción.' },
          { id: 'intensidad-malestar', label: 'Intensidad de la emoción perturbada', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Sin malestar', scaleMaxLabel: 'Malestar máximo' },
          { id: 'respuestas-conductuales', label: 'Respuestas conductuales y fisiológicas', type: 'texto_largo', helpText: 'Qué hizo o dejó de hacer (evitación, taquicardia, etc.).' },
        ],
      },
      {
        id: 'creencias',
        title: 'B · Creencias racionales e irracionales',
        description: 'Evaluaciones con que la persona procesa A. Núcleo del modelo: la exigencia absolutista y sus derivados frente a la alternativa flexible.',
        fields: [
          { id: 'creencia-irracional-nuclear', label: 'Creencia irracional nuclear (demanda absolutista)', type: 'texto_largo', helpText: 'Inferida por encadenamiento: "debo", "tengo que", "es absolutamente necesario que".' },
          { id: 'territorio-demanda', label: 'Territorio de la demanda', type: 'casillas', options: ['Sobre uno mismo (rendir / ser aprobado)', 'Sobre los demás (justicia / consideración)', 'Sobre la vida y el mundo (condiciones favorables)'], helpText: 'Puede haber más de un territorio implicado.' },
          { id: 'derivados-irracionales', label: 'Derivados irracionales presentes', type: 'casillas', options: ['Tremendismo (catastrofización: "es terrible / horrible")', 'Baja tolerancia a la frustración ("no se puede soportar")', 'Condena global de sí mismo ("soy un fracaso")', 'Condena global de otros ("es despreciable")', 'Condena global de la vida ("es insoportable")'], allowsOther: true },
          { id: 'creencia-racional-alternativa', label: 'Creencia racional alternativa (preferencia flexible)', type: 'texto_largo', helpText: 'P. ej. "preferiría intensamente que me aprueben, y puedo valorarme aunque no ocurra".' },
          { id: 'aceptaciones-trabajadas', label: 'Aceptaciones incondicionales a trabajar', type: 'casillas', options: ['De uno mismo', 'De los otros', 'De la vida'] },
        ],
      },
      {
        id: 'problema-secundario',
        title: 'Problema emocional secundario (meta-malestar)',
        description: 'Perturbación sobre la perturbación. Suele mantener y amplificar el problema primario; con frecuencia conviene tratarlo primero.',
        fields: [
          { id: 'presencia-meta-malestar', label: '¿Existe perturbación secundaria?', type: 'seleccion', options: ['Sí', 'No', 'Por evaluar'] },
          { id: 'descripcion-meta-malestar', label: 'Descripción del meta-malestar', type: 'texto_largo', helpText: 'P. ej. angustia por la ansiedad, vergüenza de la ira, depresión por la depresión.' },
          { id: 'prioridad-abordaje', label: 'Prioridad de abordaje', type: 'seleccion', options: ['Tratar primero el problema secundario', 'Tratar primero el problema primario', 'Abordaje simultáneo', 'Por determinar'] },
        ],
      },
      {
        id: 'debate-reestructuracion',
        title: 'D · Debate y reestructuración',
        description: 'Examen sistemático de la creencia irracional mediante las cuatro estrategias y plan de práctica emotiva y conductual.',
        fields: [
          { id: 'estrategias-debate', label: 'Estrategias de debate empleadas', type: 'casillas', options: ['Empírico (¿qué evidencia hay?)', 'Lógico (¿se sigue de las premisas?)', 'Pragmático / funcional (¿adónde me lleva?)', 'Construcción de la alternativa racional'] },
          { id: 'estilo-debate', label: 'Estilo de debate', type: 'casillas', options: ['Socrático', 'Didáctico', 'Humor respetuoso', 'Autoapertura del terapeuta'], allowsOther: true },
          { id: 'tecnicas-emotivo-conductuales', label: 'Técnicas emotivas y conductuales', type: 'casillas', options: ['Imaginación racional emotiva', 'Ejercicios de ataque a la vergüenza', 'Tareas conductuales / exposición entre sesiones', 'Frases racionales de afrontamiento', 'Refuerzos y costes autoadministrados', 'Práctica de asertividad'], allowsOther: true },
          { id: 'tarea-entre-sesiones', label: 'Tarea acordada entre sesiones', type: 'texto_largo', helpText: 'Doble componente: qué hará, qué se dirá mientras lo hace y qué registrará (autorregistro ABC).' },
          { id: 'conviccion-creencia-racional', label: 'Grado de convicción en la creencia racional', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'No la creo', scaleMaxLabel: 'La creo plenamente' },
        ],
      },
    ],
  },
  {
    id: 'builtin-act',
    name: 'Contextual (ACT y mindfulness)',
    therapyType: 'Contextual (ACT)',
    description: 'Núcleo ACT: evitación, fusión, presente, yo-contexto, valores y acción comprometida hacia la flexibilidad psicológica.',
    sections: [
      {
        id: 'evitacion-experiencial-agenda-control',
        title: 'Evitación experiencial y agenda de control',
        description: 'Análisis funcional de qué experiencias internas se intentan no tener y a qué costo.',
        fields: [
          { id: 'experiencias-internas-intolerables', label: 'Experiencias privadas que la persona vive como intolerables', type: 'casillas', options: ['Ansiedad o angustia', 'Tristeza o vacío', 'Recuerdos o imágenes', 'Autocrítica o pensamientos sobre sí', 'Sensaciones corporales (dolor, tensión)', 'Ira o irritabilidad', 'Culpa o vergüenza', 'Aburrimiento o inquietud'], allowsOther: true },
          { id: 'estrategias-control-evitacion', label: 'Estrategias de control y evitación (qué hace para no tenerlas)', type: 'texto_largo', helpText: 'Incluye formas obvias y sutiles: evitar lugares, consumir, rumiar, buscar reaseguro, perfeccionismo, distracción.' },
          { id: 'funcionamiento-corto-largo-plazo', label: '¿Cómo le ha funcionado? (alivio a corto plazo vs. costo a largo plazo)', type: 'texto_largo', helpText: 'Revisión honesta de la agenda de control: alivio inmediato y estrechamiento de la vida con el tiempo.' },
          { id: 'amplitud-vida-evitacion', label: 'Grado en que la vida se organiza alrededor de no sentir', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Evita en situaciones puntuales', scaleMaxLabel: 'La vida gira en torno a evitar' },
        ],
      },
      {
        id: 'fusion-cognitiva-defusion',
        title: 'Fusión cognitiva y defusión',
        description: 'Relación rígida con pensamientos que gobiernan la conducta como si fueran hechos u órdenes.',
        fields: [
          { id: 'pensamientos-reglas-fusionadas', label: 'Pensamientos, reglas o autonarrativas con que está fusionado/a', type: 'texto_largo', helpText: 'Ej.: "soy una carga", "si me duele, me estoy dañando". Anota cómo gobiernan la conducta.' },
          { id: 'grado-dominancia-literal', label: 'Dominancia literal del pensamiento sobre la conducta', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Lo observa como evento mental', scaleMaxLabel: 'Obedece al pensamiento sin distancia' },
          { id: 'tecnicas-defusion-aplicadas', label: 'Técnicas de defusión exploradas o aplicadas', type: 'casillas', options: ['Etiquetar el proceso ("estoy teniendo el pensamiento de…")', 'Repetición rápida de la palabra', 'Agradecer a la mente / ponerle voz', 'Escribir el pensamiento en una tarjeta', 'Hojas en el río / nubes en el cielo', 'Observar y nombrar el pensar'], allowsOther: true },
          { id: 'respuesta-defusion', label: 'Respuesta del paciente a la defusión', type: 'texto_largo', helpText: 'Recuerda: la meta es elegir la conducta con el pensamiento presente, no que desaparezca.' },
        ],
      },
      {
        id: 'presente-yo-contexto-mindfulness',
        title: 'Contacto con el presente y yo-como-contexto',
        description: 'Atención flexible al aquí-ahora y perspectiva del yo que observa, distinto de sus contenidos.',
        fields: [
          { id: 'donde-vive-atencion', label: '¿Dónde vive su atención habitualmente?', type: 'seleccion', options: ['Anclada en el presente', 'Rumiando el pasado', 'Anticipando o temiendo el futuro', 'Atrapada en la historia que se cuenta de sí', 'Variable según el contexto'] },
          { id: 'autoconcepto-rigido', label: 'Autoconcepto rígido que funciona como jaula', type: 'texto_largo', helpText: 'Negativo ("soy un enfermo") o positivo que encarcela ("soy el fuerte de la familia").' },
          { id: 'practicas-mindfulness-empleadas', label: 'Prácticas de contacto con el presente empleadas', type: 'casillas', options: ['Anclaje en la respiración', 'Anclaje sensorial / externo (sonidos, pies en el suelo)', 'Exploración corporal (body scan)', 'Notar y volver', 'Atención plena a actividad cotidiana', 'Ejercicios de toma de perspectiva (el observador)'], allowsOther: true },
          { id: 'precaucion-practica-meditativa', label: 'Precauciones para la práctica meditativa', type: 'casillas', options: ['Sin contraindicaciones detectadas', 'Trauma no estabilizado: usar anclas externas y ojos abiertos', 'Historia de despersonalización / disociación', 'Antecedentes psicóticos: evitar práctica intensiva', 'Aumento de ansiedad con la práctica', 'Requiere duraciones breves y permiso para detenerse'], allowsOther: true },
        ],
      },
      {
        id: 'valores-dominios-vitales',
        title: 'Valores por dominios vitales',
        description: 'Direcciones vitales elegidas que dan sentido a la acción; distintas de las metas.',
        fields: [
          { id: 'dominios-valores-priorizados', label: 'Dominios vitales más significativos a trabajar', type: 'casillas', options: ['Vínculos y familia', 'Pareja e intimidad', 'Crianza / paternidad-maternidad', 'Trabajo y productividad', 'Salud y autocuidado', 'Aprendizaje y crecimiento', 'Comunidad y ciudadanía', 'Ocio, espiritualidad y disfrute'], allowsOther: true },
          { id: 'valores-formulados-presente', label: 'Valores formulados como direcciones (en presente)', type: 'texto_largo', helpText: 'Ej.: "ser una madre presente". No metas. Donde más duele suele importar más.' },
          { id: 'claridad-valores', label: 'Claridad del paciente sobre sus valores', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Valores difusos o impuestos', scaleMaxLabel: 'Valores claros y propios' },
          { id: 'dolor-valor-vinculado', label: 'Dolor vinculado al valor (dos caras de la misma moneda)', type: 'texto_largo', helpText: 'Qué duele en cada dominio y qué importa detrás de ese dolor.' },
        ],
      },
      {
        id: 'accion-comprometida-flexibilidad',
        title: 'Acción comprometida e inflexibilidad psicológica',
        description: 'Traducción de valores en conducta graduada y balance global de flexibilidad psicológica.',
        fields: [
          { id: 'metas-accion-valiosa', label: 'Metas de acción valiosa pactadas (graduadas y al servicio de valores)', type: 'texto_largo', helpText: 'Concretas y crecientes. No "reducir la ansiedad", sino "retomar X conducta con el malestar presente".' },
          { id: 'barreras-accion', label: 'Barreras a la acción comprometida', type: 'casillas', options: ['Barreras internas ("iré cuando tenga ganas")', 'Fusión con reglas o autocrítica', 'Evitación experiencial activa', 'Falta de habilidades conductuales', 'Barreras externas o logísticas', 'Falta de apoyo social'], allowsOther: true },
          { id: 'perfil-inflexibilidad-psicologica', label: 'Procesos del hexaflex más comprometidos (inflexibilidad)', type: 'casillas', options: ['Evitación experiencial', 'Fusión cognitiva', 'Desconexión del presente', 'Apego a un autoconcepto rígido (yo-contenido)', 'Falta de claridad en valores', 'Inacción, impulsividad o evitación persistente'] },
          { id: 'flexibilidad-psicologica-global', label: 'Flexibilidad psicológica global (estimación clínica)', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Inflexibilidad marcada', scaleMaxLabel: 'Alta flexibilidad psicológica' },
        ],
      },
    ],
  },
  {
    id: 'builtin-activacion-conductual',
    name: 'Activación conductual',
    therapyType: 'Activación conductual',
    description: 'Núcleo para activación conductual: monitoreo de actividad-ánimo, análisis de la evitación, valores y jerarquía graduada.',
    sections: [
      {
        id: 'linea-base-actividad-animo',
        title: 'Línea base: registro de actividad y ánimo',
        description: 'Automonitoreo semanal para establecer la covariación entre lo que la persona hace y cómo se siente, antes de programar el cambio.',
        fields: [
          { id: 'actividades-que-sostiene', label: 'Actividades que aún sostiene y le dan algo de ánimo o sentido', type: 'texto_largo', helpText: 'Lo que todavía hace y conserva algún valor, aunque sea mínimo.' },
          { id: 'actividades-abandonadas', label: 'Actividades valiosas que dejó de hacer desde el episodio', type: 'texto_largo' },
          { id: 'animo-promedio-base', label: 'Ánimo promedio en la semana de línea base', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Pésimo', scaleMaxLabel: 'Óptimo' },
          { id: 'formato-registro-acordado', label: 'Formato de automonitoreo acordado', type: 'seleccion', options: ['Grilla por bloques horarios en papel', 'Aplicación o nota digital', 'Notas de voz', 'Tres anotaciones diarias', 'Otro'], allowsOther: true, helpText: 'El formato más simple que la persona pueda sostener.' },
          { id: 'covariacion-observada', label: 'Covariación actividad–ánimo observada en el registro', type: 'texto_largo', helpText: 'Patrones que la persona descubre en sus propios datos.' },
        ],
      },
      {
        id: 'analisis-funcional-evitacion',
        title: 'Análisis funcional de la evitación',
        description: 'Lectura funcional de la conducta depresiva como evitación/escape: disparador, emoción, patrón y consecuencias a corto y mediano plazo.',
        fields: [
          { id: 'patrones-evitacion', label: 'Conductas de evitación o escape predominantes', type: 'casillas', options: ['Quedarse en cama', 'Cancelar o posponer planes', 'Aislamiento social', 'Posponer trámites u obligaciones', 'Uso prolongado de pantallas', 'Consumo de sustancias', 'Rumia'], allowsOther: true },
          { id: 'disparador-emocion', label: 'Disparador y emoción que anteceden a la evitación', type: 'texto_largo', helpText: 'Secuencia disparador → respuesta emocional.' },
          { id: 'funcion-alivio-corto-plazo', label: 'Función de alivio inmediato que cumple la evitación', type: 'texto_largo' },
          { id: 'costos-mediano-plazo', label: 'Costos a mediano plazo de la evitación', type: 'texto_largo', helpText: 'Deudas, conflictos, aislamiento, autocrítica, pérdida de refuerzo.' },
          { id: 'funcion-rumia', label: 'Función de la rumia como conducta', type: 'texto_largo', helpText: 'Qué consigue y qué le cuesta darle vueltas al problema.' },
        ],
      },
      {
        id: 'valores-areas-vitales',
        title: 'Valores y actividades con sentido por áreas vitales',
        description: 'Clarificación de qué clase de persona quiere ser el consultante en cada área, y derivación de actividades concretas y observables.',
        fields: [
          { id: 'areas-prioritarias', label: 'Áreas vitales prioritarias para reactivar', type: 'casillas', options: ['Relaciones y familia', 'Trabajo o estudio', 'Salud y autocuidado', 'Recreación y placer', 'Espiritualidad o religiosidad', 'Comunidad y vida social'], allowsOther: true },
          { id: 'valores-por-area', label: 'Valores declarados en las áreas prioritarias', type: 'texto_largo', helpText: 'Qué clase de persona quiere ser en cada área, más allá de cómo se sienta.' },
          { id: 'actividades-derivadas', label: 'Actividades concretas derivadas de esos valores', type: 'texto_largo', helpText: 'Observables y calendarizables, ancladas en recursos reales de su territorio.' },
        ],
      },
      {
        id: 'jerarquia-programacion',
        title: 'Jerarquía y programación de actividades graduadas',
        description: 'Menú de actividades ordenadas de menor a mayor esfuerzo, con equilibrio entre placer y dominio, programadas para el peor día.',
        fields: [
          { id: 'actividad-facil-inicial', label: 'Actividad inicial (peor día, casi ridículamente alcanzable)', type: 'texto_corto' },
          { id: 'jerarquia-actividades', label: 'Jerarquía de actividades de menor a mayor dificultad', type: 'texto_largo', helpText: 'Idealmente unas 15 actividades ordenadas por esfuerzo.' },
          { id: 'tipo-actividad-predominante', label: 'Equilibrio buscado entre placer y dominio/logro', type: 'seleccion', options: ['Predominio de placer', 'Predominio de dominio o logro', 'Equilibrio entre ambos'] },
          { id: 'programacion-especifica', label: 'Programación semanal (día, hora, duración, con quién)', type: 'texto_largo', helpText: 'Específica y realista; "caminar más" no es una asignación.' },
          { id: 'respuesta-alternativa-aproximacion', label: 'Conducta alternativa de aproximación a ensayar ante el disparador', type: 'texto_largo', helpText: 'Sustituir la evitación manteniendo el mismo disparador y emoción.' },
        ],
      },
      {
        id: 'barreras-contingencias',
        title: 'Barreras, contingencias y revisión',
        description: 'Anticipación de obstáculos, plan alternativo, contexto interpersonal que modula el refuerzo y revisión sin reproche de lo cumplido.',
        fields: [
          { id: 'obstaculos-anticipados', label: 'Obstáculos anticipados para cumplir lo programado', type: 'texto_largo', helpText: '¿Qué podría impedirlo? ¿Qué hará si llueve o si llega el desánimo?' },
          { id: 'plan-alternativo', label: 'Plan alternativo ante esos obstáculos', type: 'texto_largo' },
          { id: 'contexto-interpersonal', label: 'Contexto interpersonal que modula el refuerzo', type: 'texto_largo', helpText: 'Familias que sobreprotegen, parejas que critican, entornos castigantes.' },
          { id: 'limitaciones-contextuales-reales', label: 'Limitaciones materiales o contextuales reales a respetar', type: 'texto_largo', helpText: 'Precariedad, cuidado de terceros, dolor crónico, discapacidad.' },
          { id: 'revision-consecuencias', label: 'Revisión: consecuencias de lo cumplido y lectura funcional de lo incumplido', type: 'texto_largo', helpText: '¿Qué notó en el ánimo antes, durante y después? Lo incumplido como información, nunca como falta.' },
        ],
      },
    ],
  },
  {
    id: 'builtin-dbt',
    name: 'Dialéctico-conductual (DBT)',
    therapyType: 'Dialéctico-conductual',
    description: 'Núcleo DBT: teoría biosocial, jerarquía de objetivos, perfil de desregulación, módulos de habilidades y encuadre del programa.',
    sections: [
      {
        id: 'teoria-biosocial',
        title: 'Teoría biosocial',
        description: 'Transacción entre vulnerabilidad emocional de base y ambiente invalidante que sostiene la desregulación.',
        fields: [
          { id: 'vulnerabilidad-emocional', label: 'Vulnerabilidad emocional (sensibilidad, intensidad, retorno a la línea de base)', type: 'texto_largo', helpText: 'Alta sensibilidad a estímulos emocionales, reacciones intensas y retorno lento a la calma.' },
          { id: 'ambiente-invalidante', label: 'Ambiente invalidante (histórico y actual)', type: 'texto_largo', helpText: 'Entorno que comunica que las emociones son incorrectas, exageradas o manipuladoras.' },
          { id: 'fuentes-invalidacion-actual', label: 'Fuentes de invalidación vigentes', type: 'casillas', options: ['Familia de origen', 'Pareja', 'Entorno laboral o académico', 'Sistema de salud', 'Pares o amistades', 'Autoinvalidación'], allowsOther: true },
          { id: 'transaccion-funcion', label: 'Lectura transaccional y función de las conductas problema', type: 'texto_largo', helpText: 'Cómo las conductas problema resuelven a corto plazo (alivio inmediato, respuesta del entorno).' },
        ],
      },
      {
        id: 'perfil-desregulacion',
        title: 'Perfil de desregulación por áreas',
        description: 'Mapa de la desregulación nuclear y sus consecuencias en las cinco áreas DBT.',
        fields: [
          { id: 'areas-afectadas', label: 'Áreas de desregulación presentes', type: 'casillas', options: ['Emocional', 'Conductual', 'Interpersonal', 'Del self / identidad', 'Cognitiva'] },
          { id: 'intensidad-desregulacion-emocional', label: 'Intensidad de la desregulación emocional', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Modulada', scaleMaxLabel: 'Severa / fuera de control' },
          { id: 'predominio-estado-mental', label: 'Estado mental predominante en crisis', type: 'seleccion', options: ['Mente emocional', 'Mente racional', 'Acceso a mente sabia', 'Oscilante'] },
          { id: 'manifestaciones-clave', label: 'Manifestaciones clave por área (impulsividad, inestabilidad relacional, alteración de identidad, distorsiones)', type: 'texto_largo' },
        ],
      },
      {
        id: 'jerarquia-etapa',
        title: 'Jerarquía de objetivos y etapa',
        description: 'Encuadre de la agenda según la jerarquía DBT y etapa del tratamiento (no sustituye la evaluación de riesgo).',
        fields: [
          { id: 'etapa-tratamiento', label: 'Etapa del tratamiento', type: 'seleccion', options: ['Pretratamiento / compromiso', 'Etapa 1 (control conductual)', 'Etapa 2 (procesamiento postraumático)', 'Etapa 3 (problemas ordinarios de la vida)', 'Etapa 4 (sentido y plenitud)'] },
          { id: 'objetivos-prioritarios', label: 'Objetivos prioritarios activos según la jerarquía', type: 'casillas', options: ['Conductas que atentan contra la vida', 'Conductas que interfieren con la terapia', 'Conductas que interfieren con la calidad de vida', 'Aumento de habilidades'] },
          { id: 'conductas-interfieren-terapia', label: 'Conductas que interfieren con la terapia', type: 'texto_largo', helpText: 'Inasistencias, llegar intoxicado, no traer el registro diario, hostilidad; incluir también las del terapeuta.' },
          { id: 'conductas-calidad-vida', label: 'Conductas que interfieren con la calidad de vida', type: 'texto_largo', helpText: 'Consumo, crisis económicas o legales, relaciones destructivas.' },
          { id: 'estado-compromiso', label: 'Estado del compromiso con el tratamiento', type: 'seleccion', options: ['Construido y firme', 'Parcial / ambivalente', 'Frágil o por renovar', 'Roto / en reparación'] },
        ],
      },
      {
        id: 'habilidades-modulos',
        title: 'Habilidades por módulo',
        description: 'Déficit y dominio en los cuatro módulos de entrenamiento en habilidades.',
        fields: [
          { id: 'modulos-foco', label: 'Módulos en foco actual', type: 'casillas', options: ['Atención plena (mindfulness)', 'Tolerancia al malestar', 'Regulación emocional', 'Efectividad interpersonal'] },
          { id: 'habilidades-deficitarias', label: 'Habilidades deficitarias prioritarias', type: 'casillas', options: ['Observar / describir / participar', 'Sin juzgar / una cosa a la vez / con efectividad', 'Verificar los hechos', 'Acción opuesta', 'Regulación fisiológica rápida (temperatura, ejercicio, respiración)', 'Distracción y autocalma', 'Aceptación radical', 'Petición asertiva y decir no'], allowsOther: true },
          { id: 'habilidades-afianzadas', label: 'Habilidades ya afianzadas', type: 'texto_largo' },
          { id: 'reduccion-vulnerabilidad', label: 'Reducción de vulnerabilidad (sueño, alimentación, ejercicio, salud física, experiencias positivas)', type: 'texto_largo' },
        ],
      },
      {
        id: 'encuadre-programa',
        title: 'Encuadre del programa y modos',
        description: 'Nivel de implementación y reglas de los modos de atención DBT.',
        fields: [
          { id: 'nivel-implementacion', label: 'Nivel de implementación', type: 'seleccion', options: ['Práctica informada por DBT', 'Entrenamiento en habilidades independiente', 'Programa adherente (cuatro modos)'] },
          { id: 'modos-activos', label: 'Modos de atención activos', type: 'casillas', options: ['Terapia individual', 'Grupo de entrenamiento en habilidades', 'Coaching entre sesiones', 'Equipo de consulta del terapeuta'] },
          { id: 'reglas-coaching', label: 'Reglas del coaching telefónico acordadas', type: 'texto_largo', helpText: 'Cuándo, para qué, duración y qué ocurre si la conducta problema ya sucedió.' },
          { id: 'herramientas-monitoreo', label: 'Herramientas de monitoreo en uso', type: 'casillas', options: ['Registro / tarjeta diaria', 'Análisis en cadena', 'Análisis de soluciones'], allowsOther: true },
          { id: 'soporte-equipo-consulta', label: 'Soporte de equipo de consulta o interconsulta', type: 'texto_corto', helpText: 'Equipo formado, interconsulta entre colegas o ausente.' },
        ],
      },
    ],
  },
  {
    id: 'builtin-humanista',
    name: 'Humanista / centrado en la persona',
    therapyType: 'Humanista',
    description: 'Núcleo fenomenológico rogeriano: marco de referencia interno, incongruencia, tendencia actualizante, condiciones de la relación y proceso de cambio.',
    sections: [
      {
        id: 'marco-referencia-interno',
        title: 'Marco de referencia interno',
        description: 'Cómo vive y significa la persona su propio mundo, desde su experiencia y no desde la etiqueta.',
        fields: [
          { id: 'como-es-ser-esta-persona', label: '¿Cómo es ser esta persona hoy? (en sus propias palabras)', type: 'texto_largo', helpText: 'Vivencia subjetiva del consultante, evitando lenguaje diagnóstico.' },
          { id: 'motivo-vivido', label: 'Lo que trae a consulta, tal como lo experimenta', type: 'texto_largo', helpText: 'El sufrimiento o malestar desde su significado, no como síntoma.' },
          { id: 'nivel-proceso-experiencial', label: 'Nivel de proceso experiencial', type: 'seleccion', options: ['Habla de temas externos; no reconoce sentimientos propios', 'Habla de sí en pasado y desde fuera; sentimientos como ajenos', 'Nombra sentimientos con desconfianza; primeras dudas sobre sus esquemas', 'Contacta y simboliza lo que siente mientras lo siente; constructos revisables'], helpText: 'Escala de fijeza a fluidez (Rogers).' },
          { id: 'locus-evaluacion', label: 'Locus de evaluación predominante', type: 'seleccion', options: ['Externo: decide qué sentir y valer según criterios ajenos', 'Mixto: oscila entre criterio propio y ajeno', 'Interno: la propia experiencia recupera autoridad como fuente de valor'] },
        ],
      },
      {
        id: 'incongruencia-self-experiencia',
        title: 'Incongruencia entre el yo y la experiencia',
        description: 'Brecha entre la imagen de sí y lo que el organismo realmente vive.',
        fields: [
          { id: 'experiencias-sin-permiso', label: 'Experiencias que parecen no tener permiso de existir', type: 'texto_largo', helpText: 'Emociones o vivencias que la persona niega o distorsiona.' },
          { id: 'condiciones-de-valia', label: 'Condiciones de valía operantes', type: 'texto_largo', helpText: 'Cláusulas implícitas tipo "solo valgo si…", y en qué relaciones se aprendieron.' },
          { id: 'areas-incongruencia', label: 'Áreas donde aparece la incongruencia', type: 'casillas', options: ['Emociones (rabia, vergüenza, miedo no admitidos)', 'Vínculos significativos', 'Cuerpo y sensaciones', 'Trabajo / rendimiento / autoexigencia', 'Identidad o roles esperados', 'Sentido y proyecto vital'], allowsOther: true },
          { id: 'discrepancia-dicho-mostrado', label: 'Discrepancias entre lo dicho y lo mostrado (tono, cuerpo, actos)', type: 'texto_largo' },
          { id: 'costo-defensivo', label: 'Costo del trabajo defensivo (cómo se paga la incongruencia)', type: 'texto_corto', helpText: 'Ansiedad, rigidez, agotamiento, síntomas.' },
        ],
      },
      {
        id: 'tendencia-actualizante-recursos',
        title: 'Tendencia actualizante y recursos',
        description: 'Dónde se asoma el impulso de crecimiento y con qué cuenta la persona.',
        fields: [
          { id: 'donde-asoma-crecimiento', label: '¿Dónde se asoma la tendencia al crecimiento, aun de forma torpe o sintomática?', type: 'texto_largo' },
          { id: 'recursos-fortalezas', label: 'Recursos y fortalezas del consultante', type: 'texto_largo', helpText: 'Capacidades, vínculos, intereses, logros propios.' },
          { id: 'direccion-deseada', label: 'Hacia dónde tiende la persona cuando las condiciones lo permiten', type: 'texto_corto' },
          { id: 'claridad-direccion', label: 'Claridad de la dirección de crecimiento percibida', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Aún muy velada', scaleMaxLabel: 'Claramente perceptible' },
        ],
      },
      {
        id: 'condiciones-relacion-alianza',
        title: 'Condiciones de la relación y vivencia de la alianza',
        description: 'Empatía, aceptación incondicional y congruencia, y cómo el consultante recibe la relación (sexta condición).',
        fields: [
          { id: 'contacto-psicologico', label: 'Calidad del contacto psicológico', type: 'seleccion', options: ['Frágil o intermitente', 'En formación', 'Establecido y mutuo'] },
          { id: 'vivencia-empatia-aceptacion', label: '¿Cómo vive el consultante la empatía y la aceptación recibidas?', type: 'texto_largo', helpText: 'Sexta condición: verifícalo con la persona, no lo supongas.' },
          { id: 'indicadores-relacion-terapeutica', label: 'Indicadores de las actitudes en sesión', type: 'casillas', options: ['Corrige o profundiza los reflejos ("exacto, es eso")', 'Se atreve a mostrar lo que antes ocultaba', 'Disminuyen justificaciones y defensas', 'Aparece material nuevo o se ralentiza el discurso', 'Silencios fértiles con presencia', 'Puede nombrar lo que ocurre en la relación'], allowsOther: true },
          { id: 'congruencia-vinculo-terapeuta', label: 'Mi congruencia y resonancia en el vínculo (notas del terapeuta)', type: 'texto_largo', helpText: 'Lo que registro en mí dentro de la relación; material para supervisión.' },
          { id: 'percepcion-alianza', label: 'Calidad de la alianza percibida por el consultante', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'No se siente comprendido', scaleMaxLabel: 'Plenamente comprendido y aceptado' },
        ],
      },
      {
        id: 'proceso-cambio-vivencial',
        title: 'Proceso de cambio vivencial',
        description: 'Movimiento de la fijeza a la fluidez y cómo se acompaña su ritmo.',
        fields: [
          { id: 'movimiento-observado', label: 'Movimiento observado en el proceso (de la fijeza a la fluidez)', type: 'texto_largo' },
          { id: 'momentos-significativos', label: 'Momentos vivenciales significativos del proceso', type: 'texto_largo', helpText: 'Apertura de una condición de valía, emoción en presente, giro hacia locus interno.' },
          { id: 'respuestas-que-acompanan', label: 'Respuestas que acompañan el ritmo actual', type: 'casillas', options: ['Reflejo de contenido / paráfrasis', 'Reflejo de sentimiento (tentativo)', 'Respuestas en el borde de la conciencia', 'Clarificación desde el no saber', 'Personalización (del afuera a la propia experiencia)', 'Silencio sostenido con presencia', 'Inmediatez / congruencia expresada'], allowsOther: true, helpText: 'Calibra al nivel de proceso; no respondas en el nivel 7 a quien está en el 2.' },
          { id: 'ritmo-direccionalidad', label: 'Ritmo y direccionalidad a respetar', type: 'texto_corto', helpText: 'Qué acompañar y qué aún no forzar.' },
        ],
      },
    ],
  },
  {
    id: 'builtin-gestalt',
    name: 'Gestalt',
    therapyType: 'Gestalt',
    description: 'Diagnóstico procesual gestáltico: awareness, ciclo de la experiencia, mecanismos de evitación del contacto y asuntos inconclusos.',
    sections: [
      {
        id: 'awareness-aqui-ahora',
        title: 'Darse cuenta y aquí y ahora',
        description: 'Mapa del awareness por zonas y de la organización figura-fondo en la sesión.',
        fields: [
          { id: 'zonas-awareness-desbalance', label: 'Predominio o desbalance entre zonas del darse cuenta', type: 'casillas', options: ['Zona interna (sensaciones y emociones)', 'Zona externa (percepción del entorno)', 'Zona intermedia (pensamientos, fantasías, anticipaciones)', 'Atrapado/a en la zona intermedia (rumiación)', 'Acceso fluido a las tres zonas'], allowsOther: true, helpText: 'Vivir "atrapado" en la zona intermedia es un foco clínico habitual.' },
          { id: 'calidad-awareness', label: 'Calidad del darse cuenta', type: 'escala', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Intelectualiza / autoanaliza', scaleMaxLabel: 'Contacto directo y no enjuiciador' },
          { id: 'figuras-energia-evita', label: 'Figuras: de qué habla con energía y qué temas se apagan', type: 'texto_largo', helpText: 'Qué figuras logra formar el consultante y cuáles evita.' },
          { id: 'presente-pasado-futuro', label: 'Cómo trae el pasado/futuro al presente de la sesión', type: 'texto_largo', helpText: 'Cómo recuerda, anticipa, evita o se tensa ahora, mientras habla.' },
        ],
      },
      {
        id: 'ciclo-experiencia',
        title: 'Ciclo de la experiencia y frontera de contacto',
        description: 'Dónde se interrumpe sistemáticamente la secuencia de autorregulación organísmica.',
        fields: [
          { id: 'fase-interrupcion', label: 'Fase del ciclo donde se interrumpe la experiencia', type: 'seleccion', options: ['Reposo / vacío fértil', 'Sensación', 'Formación de figura / darse cuenta', 'Movilización de energía', 'Acción', 'Contacto pleno', 'Asimilación y retirada'], helpText: '¿En qué punto del ciclo se apaga sistemáticamente la experiencia?' },
          { id: 'frontera-contacto', label: 'Cualidad de la frontera de contacto', type: 'seleccion', options: ['Permeable y firme (sana)', 'Demasiado permeable (no filtra lo tóxico)', 'Demasiado rígida (no entra lo nutritivo)', 'Difusa / sin diferenciación', 'Variable según el vínculo'] },
          { id: 'contacto-en-sesion', label: 'Cómo es el contacto en sesión', type: 'texto_largo', helpText: 'Mirada, postura, respiración, ritmo del habla, capacidad de recibir lo ofrecido.' },
          { id: 'soportes-disponibles', label: 'Soportes para sostener el trabajo', type: 'casillas', options: ['Corporales (respiración, regulación)', 'Relacionales (red de apoyo, alianza)', 'Materiales / contexto', 'Capacidad de autorregulación', 'Soportes insuficientes para experimentos intensos'], allowsOther: true },
        ],
      },
      {
        id: 'mecanismos-evitacion-contacto',
        title: 'Mecanismos de evitación del contacto',
        description: 'Patrones aprendidos de interrupción del intercambio con el entorno.',
        fields: [
          { id: 'mecanismo-predominante', label: 'Mecanismo predominante', type: 'seleccion', options: ['Introyección', 'Proyección', 'Retroflexión', 'Confluencia', 'Deflexión', 'Desensibilización'], helpText: 'El que gobierna con más fuerza la interrupción del contacto.' },
          { id: 'mecanismos-presentes', label: 'Otros mecanismos presentes', type: 'casillas', options: ['Introyección', 'Proyección', 'Retroflexión', 'Confluencia', 'Deflexión', 'Desensibilización'], allowsOther: true },
          { id: 'como-se-ve-en-sesion', label: 'Cómo se manifiesta en sesión (descriptivo)', type: 'texto_largo', helpText: 'Regístralo en términos descriptivos ("baja el volumen al hablar del padre"), no interpretativos.' },
          { id: 'direccion-trabajo-contacto', label: 'Dirección de trabajo según la interrupción', type: 'texto_largo', helpText: 'Ej.: masticar lo introyectado, reapropiar lo proyectado, redirigir la retroflexión hacia afuera.' },
        ],
      },
      {
        id: 'asuntos-inconclusos-polaridades',
        title: 'Asuntos inconclusos y polaridades',
        description: 'Gestalts abiertas que demandan energía y fragmentaciones del self.',
        fields: [
          { id: 'asuntos-inconclusos', label: 'Asuntos inconclusos (gestalts abiertas)', type: 'texto_largo', helpText: 'Duelos no expresados, rabia no dicha, despedidas que no ocurrieron; cómo se reactivan.' },
          { id: 'tipo-asunto-inconcluso', label: 'Naturaleza del asunto inconcluso principal', type: 'casillas', options: ['Duelo no elaborado', 'Rabia / reclamo no expresado', 'Despedida pendiente', 'Necesidad no reconocida ni pedida', 'Vínculo no resuelto (presente, ausente o fallecido)'], allowsOther: true },
          { id: 'polaridades-desbalanceadas', label: 'Polaridades rígidamente desbalanceadas', type: 'texto_largo', helpText: 'Cualidades opuestas (fortaleza/vulnerabilidad, exigencia/compasión); cuál se identifica como "yo" y cuál se aliena.' },
          { id: 'reaparicion-en-vinculo', label: 'Reaparición en la relación terapéutica u otros vínculos', type: 'texto_largo' },
        ],
      },
      {
        id: 'fenomenologia-corporal-experimento',
        title: 'Fenomenología corporal y experimentos',
        description: 'El cuerpo como dato clínico y el trabajo vivencial graduado.',
        fields: [
          { id: 'observaciones-corporales', label: 'Observaciones corporales en el aquí y ahora', type: 'texto_largo', helpText: 'Respiración, postura, gestos, tensiones; descriptivo, no interpretativo.' },
          { id: 'discrepancia-contenido-proceso', label: 'Discrepancias entre contenido verbal y proceso corporal', type: 'texto_largo', helpText: 'Ej.: narra algo doloroso con sonrisa fija o contiene la respiración al acercarse a la tristeza.' },
          { id: 'experimentos-propuestos', label: 'Experimentos propuestos y respuesta observada', type: 'texto_largo', helpText: 'Co-creados, emergentes y graduados; un "no puedo" es información, no fracaso.' },
          { id: 'tecnicas-vivenciales', label: 'Técnicas vivenciales empleadas', type: 'casillas', options: ['Silla vacía (otro significativo)', 'Dos sillas (polaridades / autocrítica)', 'Continuum de conciencia', 'Exageración y repetición', 'Trabajo con el lenguaje', 'Trabajo con sueños', 'Trabajo corporal y respiración'], allowsOther: true },
          { id: 'consentimiento-graduacion', label: 'Consentimiento y graduación de la intensidad', type: 'texto_corto', helpText: 'Verifica soportes y acuerdo previo antes de experimentos intensos.' },
        ],
      },
    ],
  },
  {
    id: 'builtin-breve-soluciones',
    name: 'Breve centrada en soluciones',
    therapyType: 'Breve en soluciones',
    description: 'Núcleo del modelo de Milwaukee: futuro preferido, excepciones, escalas 0-10 y posición del consultante.',
    sections: [
      {
        id: 'objetivos-bien-formados',
        title: 'Objetivos bien formados y mandato',
        description: 'Lo que el consultante quiere en lugar del problema, en positivo y concreto.',
        fields: [
          { id: 'objetivo-en-positivo', label: 'Objetivo en positivo (presencia de algo, no ausencia)', type: 'texto_largo', helpText: 'Ej.: "desayunar conversando con mi hijo", no "no pelear por las mañanas".' },
          { id: 'senal-conductual-cotidiana', label: 'Señal conductual concreta y observable', type: 'texto_largo', helpText: 'Qué se vería en un día cotidiano mejor.' },
          { id: 'quienes-lo-notarian', label: 'Quiénes lo notarían y qué notarían (interaccional)', type: 'texto_largo' },
          { id: 'mandato-real', label: 'Mandato real: qué quiere de la terapia', type: 'texto_largo', helpText: 'Puede no coincidir con el motivo declarado.' },
          { id: 'cambios-pretratamiento', label: 'Cambios pretratamiento (entre la cita y hoy)', type: 'texto_largo' },
        ],
      },
      {
        id: 'pregunta-milagro',
        title: 'Pregunta del milagro y futuro preferido',
        description: 'Descripción detallada de la vida sin el problema.',
        fields: [
          { id: 'variante-utilizada', label: 'Variante utilizada', type: 'seleccion', options: ['Pregunta del milagro clásica', 'Pregunta del mañana diferente', 'Versión para niños (dibujo/juego)', 'Futuro preferido sobrio'], allowsOther: true },
          { id: 'primera-senal-al-despertar', label: 'Primera señal que notaría al despertar', type: 'texto_largo' },
          { id: 'descripcion-dia-milagro', label: 'Descripción detallada del día después del milagro', type: 'texto_largo', helpText: 'Qué haría distinto, en secuencia.' },
          { id: 'reacciones-interaccionales', label: 'Quién lo notaría primero y cómo reaccionaría', type: 'texto_largo' },
        ],
      },
      {
        id: 'excepciones-recursos',
        title: 'Excepciones y recursos del consultante',
        description: 'Momentos en que el problema ocurre menos o se maneja mejor, y la agencia que los hizo posibles.',
        fields: [
          { id: 'excepcion-detectada', label: 'Excepción detectada (cuándo el problema ocurre menos o no ocurre)', type: 'texto_largo' },
          { id: 'tipo-excepcion', label: 'Tipo de excepción', type: 'seleccion', options: ['Deliberada (sabe qué hizo y puede repetirlo)', 'Espontánea (la atribuye a azar o a otros)'] },
          { id: 'agencia-del-consultante', label: 'Qué puso el consultante de su parte (agencia)', type: 'texto_largo' },
          { id: 'recursos-competencias', label: 'Recursos, competencias y logros previos', type: 'texto_largo', helpText: 'Incluye intentos parcialmente exitosos y afrontamiento en crisis.' },
          { id: 'como-repetirla', label: 'Qué haría falta para repetirla', type: 'texto_largo' },
        ],
      },
      {
        id: 'escalas-de-avance',
        title: 'Escalas de avance (0-10)',
        description: 'Punto de partida, siguiente paso pequeño y disposición al cambio.',
        fields: [
          { id: 'escala-avance-hoy', label: '¿Dónde está hoy? (0 = peor momento, 10 = día después del milagro)', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Peor momento', scaleMaxLabel: 'Día después del milagro' },
          { id: 'que-sostiene-el-numero', label: '¿Qué hace que no sea un punto menos? (recursos)', type: 'texto_largo' },
          { id: 'siguiente-paso-un-punto-mas', label: '¿Cómo sería un punto más? (siguiente paso pequeño)', type: 'texto_largo' },
          { id: 'escala-confianza-cambio', label: 'Confianza en lograr el cambio', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Nada de confianza', scaleMaxLabel: 'Total confianza' },
          { id: 'escala-disposicion-esfuerzo', label: 'Disposición a esforzarse', type: 'escala', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'Sin disposición', scaleMaxLabel: 'Máxima disposición' },
        ],
      },
      {
        id: 'posicion-cliente-progreso',
        title: 'Posición del consultante y primera señal de progreso',
        description: 'Tipo de relación terapéutica y el mensaje final ajustado a ella.',
        fields: [
          { id: 'tipo-de-relacion', label: 'Tipo de relación terapéutica predominante', type: 'seleccion', options: ['Comprador (problema propio, dispuesto a actuar)', 'Demandante (sitúa el problema fuera de sí)', 'Visitante (acude derivado u obligado, sin problema propio)'], helpText: 'Lectura dinámica: puede transitar los tres en una sesión.' },
          { id: 'tarea-ajustada', label: 'Tarea ajustada a la posición', type: 'seleccion', options: ['Tarea de acción (comprador)', 'Tarea de observación (demandante)', 'Solo elogios (visitante)'], allowsOther: true },
          { id: 'elogios-genuinos', label: 'Elogios genuinos y específicos devueltos', type: 'texto_largo' },
          { id: 'primera-senal-progreso', label: 'Primera señal de progreso acordada', type: 'texto_largo', helpText: 'Qué tendría que pasar para que venir hoy haya valido la pena.' },
        ],
      },
    ],
  },
  {
    id: 'builtin-historia-libre',
    name: 'Historia libre (texto)',
    // Sin enfoque: así el título de la historia queda simplemente "Historia clínica"
    // (EnsurePrimaryHistory.titleFor usa therapyType para el sufijo "· enfoque").
    therapyType: '',
    description: 'Un solo espacio de texto para redactar la historia clínica a tu manera, sin secciones predefinidas.',
    sections: [
      {
        id: 'historia-libre',
        title: 'Historia clínica',
        description: 'Escríbela con tus propias palabras y tu propia estructura, en un solo espacio. Siempre puedes añadir bloques después.',
        fields: [
          {
            id: 'contenido',
            label: 'Historia clínica',
            type: 'texto_largo',
            placeholder: 'Escribe aquí la historia clínica completa…',
          },
        ],
      },
    ],
  },
];

export const BUILTIN_CLINICAL_TEMPLATES: BuiltinClinicalTemplate[] = BASE_BUILTIN_CLINICAL_TEMPLATES.map(
  (template) => ({ ...template, sections: ensureAdditionalNotesSection(template.sections) }),
);
