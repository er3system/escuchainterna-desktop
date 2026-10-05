/**
 * Clasificador de alcance del asistente de IA (guardrail nº 1).
 *
 * Módulo PURO (sin dependencias de Node ni de la BD): heurística local por
 * palabras clave e intención. Se ejecuta SIEMPRE antes de cualquier retrieval
 * o llamada al motor de IA, en la capa de aplicación.
 *
 * Política: lista de permitidos (default-deny). Solo se permite hablar de los
 * pacientes propios, la consulta/práctica del profesional y el uso de la
 * plataforma. Programación/código, tareas generales y otras personas que no
 * son pacientes se rechazan; en preguntas mixtas se rechaza explícitamente la
 * parte fuera de alcance y se responde solo la parte clínica.
 */

export type ScopeVerdict = 'permitido' | 'rechazado';

export interface ScopeAnalysisOptions {
  /** Nombres completos de los pacientes del dueño en sesión (señal clínica). */
  knownPatientNames?: string[];
  /** El hilo tiene un paciente anclado: los seguimientos cortos son clínicos. */
  hasAnchoredPatient?: boolean;
}

export interface ScopeAnalysis {
  verdict: ScopeVerdict;
  /** Etiquetas de los temas fuera de alcance detectados (vacío si no hay). */
  offTopicParts: string[];
  /** Hubo señal clínica / de práctica / de plataforma en la pregunta. */
  hasClinicalSignal: boolean;
  /** Nombre completo (tal como vino en knownPatientNames) detectado, si hay. */
  matchedPatientName: string | null;
}

/** Respuesta fija y amable cuando la pregunta queda fuera del alcance. */
export const SCOPE_REJECTION_MESSAGE =
  'Solo puedo ayudarte con información de tus pacientes y tu consulta. ' +
  'Pregúntame, por ejemplo, por las notas, citas, diagnósticos o historia clínica de alguno de tus pacientes, o por el uso de la plataforma.';

/** Nota de rechazo explícito de la parte fuera de tema en preguntas mixtas. */
export function offTopicRejectionNote(offTopicParts: string[]): string {
  const temas = offTopicParts.join(', ');
  return (
    `Sobre la parte de tu mensaje fuera de mi alcance (${temas}): no puedo ayudarte con eso — ` +
    'solo respondo sobre tus pacientes, tu consulta y la plataforma. Vamos con la parte clínica:'
  );
}

/** Límite duro de longitud de pregunta (guardrail nº 3). */
export const MAX_QUESTION_LENGTH = 2000;

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Detectores de temas fuera de alcance -----------------------------------

const PROGRAMMING_KEYWORDS =
  /\b(codigo|programacion|software|javascript|typescript|python|java|php|html|css|sql|frontend|backend|algoritmo|compilar|depurar|debug|framework|github|servidor web|base de datos|app movil|aplicacion movil|sitio web|pagina web|videojuego)\b/;

// "programar" es ambiguo en español: programar una CITA es agenda (permitido);
// programar a secas o programar una app/código es desarrollo (rechazado).
const PROGRAMMING_VERB =
  /\bprogramar\b(?!\s+(?:una\s+|la\s+|mi\s+|otra\s+|las\s+|esa\s+)?(?:cita|citas|sesion|sesiones|consulta|consultas|recordatorio|recordatorios|visita|llamada))/;

const GENERAL_TASK_KEYWORDS =
  /\b(chiste|poema|cancion|cuento|receta de cocina|receta para|cocinar|clima|pronostico del tiempo|noticias|futbol|mundial|partido|pelicula|serie de tv|criptomonedas|bitcoin|invertir en|acciones de la bolsa|horoscopo|loteria|quien gano|capital de|traduceme|traducir al|ensayo escolar|tarea de matematicas|matematicas|videojuegos)\b/;

const OTHER_PEOPLE_KEYWORDS =
  /\b(mi\s+(?:vecino|vecina|esposo|esposa|novio|novia|amigo|amiga|suegra|suegro|cunado|cunada|jefe|jefa|companero|companera)|famoso|famosa|celebridad|politico|de otro psicologo|de otra psicologa|que no es mi paciente|no es paciente)\b/;

// --- Señales clínicas / de práctica / de plataforma -------------------------

const CLINICAL_KEYWORDS =
  /\b(paciente|pacientes|consulta|consultorio|terapia|terapeutico|terapeutica|sesion|sesiones|cita|citas|agenda|agendar|reagendar|nota|notas|historia clinica|historias clinicas|expediente|expedientes|diagnostico|diagnosticos|cie|tratamiento|tratamientos|evolucion|seguimiento|caso|cobro|cobros|pago|pagos|adeudo|tarifa|recordatorio|recordatorios|inasistencia|cancelacion|reservar|reserva|disponibilidad|cumpleanos|etiqueta|etiquetas|mensaje|mensajes|whatsapp|correo|plantilla|plantillas|onboarding|suscripcion|configuracion|perfil|plataforma|escuchainterna|biblioteca|genograma|mapa familiar|supervision)\b/;

const GREETING_PATTERN =
  /^[¡¿\s]*(hola|buenos dias|buen dia|buenas tardes|buenas noches|hey|que tal|gracias|muchas gracias|adios|hasta luego)[\s!.,;:?¡¿]*$/;

function detectOffTopicParts(normalized: string): string[] {
  const parts: string[] = [];
  if (PROGRAMMING_KEYWORDS.test(normalized) || PROGRAMMING_VERB.test(normalized)) {
    parts.push('programación/código');
  }
  if (GENERAL_TASK_KEYWORDS.test(normalized)) {
    parts.push('tareas generales ajenas a tu consulta');
  }
  if (OTHER_PEOPLE_KEYWORDS.test(normalized)) {
    parts.push('personas que no son tus pacientes');
  }
  return parts;
}

/**
 * Busca un nombre de paciente conocido dentro de la pregunta.
 * Prefiere la coincidencia del nombre completo; si no, un token del nombre
 * (≥ 3 caracteres) como palabra completa. Devuelve el nombre original.
 */
export function detectPatientName(question: string, knownPatientNames: string[]): string | null {
  const normalizedQuestion = normalize(question);
  let tokenMatch: string | null = null;

  // Orden por longitud descendente: "María García López" gana sobre "María".
  const sorted = [...knownPatientNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const normalizedName = normalize(name);
    if (normalizedName.length === 0) continue;
    if (normalizedQuestion.includes(normalizedName)) return name;
    if (tokenMatch === null) {
      for (const token of normalizedName.split(' ')) {
        if (token.length < 3) continue;
        if (new RegExp(`\\b${token}\\b`).test(normalizedQuestion)) {
          tokenMatch = name;
          break;
        }
      }
    }
  }
  return tokenMatch;
}

/**
 * Análisis completo de alcance. Default-deny: si la pregunta no muestra
 * ninguna señal de pacientes propios / consulta / plataforma, se rechaza.
 */
export function analyzeScope(question: string, options: ScopeAnalysisOptions = {}): ScopeAnalysis {
  const normalized = normalize(question);
  const offTopicParts = detectOffTopicParts(normalized);
  const matchedPatientName = detectPatientName(question, options.knownPatientNames ?? []);

  const isGreeting = GREETING_PATTERN.test(normalized);
  const hasClinicalSignal =
    CLINICAL_KEYWORDS.test(normalized) ||
    matchedPatientName !== null ||
    options.hasAnchoredPatient === true;

  const verdict: ScopeVerdict = isGreeting || hasClinicalSignal ? 'permitido' : 'rechazado';

  return { verdict, offTopicParts, hasClinicalSignal, matchedPatientName };
}

/** Versión binaria del clasificador (firma del puerto AssistantEngine). */
export function classifyScope(question: string): ScopeVerdict {
  return analyzeScope(question).verdict;
}
