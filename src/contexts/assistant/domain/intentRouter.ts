/**
 * Ruteo de modelo por INTENCIÓN dentro del chat clínico.
 *
 * Módulo PURO (sin Node ni BD): heurística local por palabras clave. Decide el
 * NIVEL de modelo (premium / económico) que MERECE una pregunta YA permitida por
 * el clasificador de alcance, dado si hay contexto clínico recuperado.
 *
 * Política (sesgada a la SEGURIDAD, no al ahorro) — DEFAULT-PREMIUM:
 *   1. Riesgo / crisis  → SIEMPRE premium. Invariante clínico-legal: el modelo
 *      fuerte donde el error cuesta; JAMÁS el económico para una pregunta de
 *      riesgo. El detector de riesgo es generoso a propósito (sobre-disparar a
 *      premium es seguro; el único error inaceptable es bajar una de riesgo).
 *   2. Económico SOLO para consultas inequívocamente LOGÍSTICAS (agenda,
 *      contacto, saldo, etiquetas, edad) sin contenido clínico, o —sin un
 *      paciente recuperado— para ayuda de PLATAFORMA. Detectores conservadores:
 *      cualquier señal clínica o de riesgo cancela la degradación.
 *   3. TODO lo demás → premium por defecto. Esto es deliberado: un red-team
 *      adversarial mostró que ~75% del riesgo expresado de forma EUFEMÍSTICA o
 *      indirecta ("ya cumplió su ciclo", "regaló sus cosas", "un viaje del que
 *      no piensa volver") evade cualquier detector de palabras clave. Un keyword
 *      matcher no puede cerrar ese hueco; el default-premium sí: ante la duda,
 *      el modelo fuerte. El económico queda reservado a lo que es SIN DUDA
 *      trivial. (En la práctica clínica el grueso del ahorro está justo ahí: las
 *      consultas logísticas de alto volumen sobre un paciente concreto.)
 *
 * El router NUNCA sube por encima del techo del plan: la fábrica acota los
 * candidatos, así que si el plan ya sirve el económico, ambos candidatos son el
 * económico y la decisión de "premium" del router se queda en económico (el
 * techo del plan manda; este módulo nunca regala modelo premium).
 */

export type ModelTier = 'premium' | 'economico';
export type RoutedIntent = 'riesgo' | 'clinico' | 'trivial' | 'plataforma';

export interface ModelRoute {
  intent: RoutedIntent;
  tier: ModelTier;
}

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vocabulario de RIESGO / crisis (generoso). Cualquier coincidencia fuerza
 * premium, incluso sin contexto recuperado: una pregunta de seguridad clínica
 * merece el modelo fuerte aunque no se haya anclado un paciente concreto.
 *
 * Solo se ancla el INICIO de cada token (`\b…` sin cierre) para casar por
 * prefijo: "suicid" → suicidio/suicida/suicidarse; "hospitaliz" → hospitalizar/
 * hospitalización. Sobre-disparar a premium es seguro; el único error
 * inaceptable es DEGRADAR una pregunta de riesgo.
 */
const RISK_KEYWORDS =
  /\b(suicid|autolesion|autolisis|autolitic|autoinfligir|autoagresion|autoagredir|cortarse|cortando|cortandose|se corta|se hace cortes|cortes en (el|los|la|las)|cuchilla|navaja|sacapuntas|(hacer|hace|haga|haciendo|haciendose)( |se )?(dano|heridas|marcas)|se lastima|lastimarse|se quema con|quemarse con|cicatrices|se golpea la cabeza|se rasga|rasgarse|se arana|se pellizca|quitarse la vida|quitar la vida|acabar con (su|mi) vida|terminar con (su|mi) vida|no quiere vivir|no quiero vivir|dejar de existir|cerrar los ojos y no|ideacion|intento de suicidio|intento suicida|plan suicida|plan de suicidio|desesperanza|no aguanta mas|no aguanto mas|no puedo mas|sin salida|cumplio su ciclo|no va a estar mucho|regal(o|ando|a|aba) (sus|todas sus|varias|su)|se despidio|despidiendose|despidio de|carta(s)? de despedida|dejo todo en orden|todas las pastillas|las pastillas (del|de)|guardadas? (todas )?las pastillas|guardo las pastillas|riesgo|crisis|emergencia|urgencia|hospitaliz|internar|internarlo|internarla|interno hoy|internamiento|internacion|homicid|matar|antes muertos|amenaza|violencia|maltrato|le pega|abusa|abuso|tocaba|toco a|fuerza a tener|episodio maniac|fase maniac|brote psicotic|psicotic|psicosis|delirium|delirante|desorganizad|sin contacto con la realidad|viendo cosas|fuera de si|descompens|sobredosis|intoxicad|intoxicacion|recaida|ataque de panico|panico)/;

/**
 * Vocabulario LOGÍSTICO inequívoco (estrecho). Solo habilita la degradación a
 * económico, y únicamente si NO hay contenido clínico ni riesgo en la pregunta.
 */
const TRIVIAL_LOOKUP =
  /\b(proxima cita|proximas citas|siguiente cita|cuando es la cita|cuando tiene cita|a que hora|que dia|que hora|horario|telefono|numero de (telefono|contacto)|celular|correo de|email de|direccion de|contacto de|cuanto (me )?(debe|adeuda)|saldo|pago pendiente|esta al dia|ha pagado|cumpleanos|fecha de nacimiento|que edad|cuantos anos tiene|edad de|que etiquetas|etiquetas de|etiqueta de|como (agendar|reagendar|cancelar|programar|exportar|descargar|configurar|crear)|donde (encuentro|esta|veo))\b/;

/**
 * Contenido CLÍNICO que BLOQUEA la degradación: ante cualquiera de estas señales
 * la pregunta se trata como razonamiento clínico (premium), aunque también case
 * un patrón logístico. Sesgo conservador: preferimos premium de más. Se ancla
 * solo el INICIO de cada token (prefijo): "diagnostic" → diagnóstico/diagnóstica;
 * "terapeutic" → terapéutico/terapéutica; "recomend" → recomiendas/recomendación.
 */
const CLINICAL_CONTENT =
  /\b(diagnostic|sintoma|historia clinica|expediente|nota|evolucion|seguimiento clinico|tratamiento|terapeutic|terapia|intervencion|abordaje|tecnica|emocion|estado de animo|animo|ansiedad|depresion|depresiv|angustia|miedo|fobia|trauma|duelo|estres|insomnio|sueno|formulacion|hipotesis|interpret|recomend|sugieres|deberia|que hago con|como (abordo|trabajo|manejo|interpreto)|plan de tratamiento|objetivo terapeutic|vinculo|conflicto|progreso|mejoria|cuestionario|phq|gad|puntaje|severidad|escala|medicacion|farmaco|conducta|comportamiento|riesgo)/;

/**
 * Ayuda de PLATAFORMA / práctica no clínica. Solo habilita el económico cuando
 * NO hay un paciente recuperado (consultas de "cómo uso la app", facturación,
 * suscripción): sin caso que razonar y sin riesgo, basta el modelo económico.
 */
const PLATFORM_HELP =
  /\b(plataforma|biblioteca|suscripcion|configur|ajustes|recordatorio|plantilla|marketing|campana|tutorial|onboarding|factura|export|descarg|como (uso|funciona|activ|cre|configur|export|descarg|agend|cancel))/;

/**
 * Decide el nivel de modelo para una pregunta YA permitida por el clasificador
 * de alcance. `hasContext` indica si el retriever recuperó contexto clínico del
 * paciente (autorizado por consentimiento-IA): es la señal de que el hilo está
 * razonando sobre un caso real.
 */
/**
 * Longitud máxima (normalizada) de una pregunta que puede DEGRADARSE a
 * económico. Una consulta logística real es corta ("¿cuándo es la próxima cita
 * de Ana?"); un mensaje LARGO que además case un patrón logístico suele traer
 * contexto clínico o de riesgo — a veces eufemístico, invisible para el léxico
 * ("¿a qué hora es la cita? me dijo que estaría mejor si no despertara…"). Ante
 * esa mezcla, premium. El guard cuesta unos pocos falsos-premium (baratos) y
 * cierra la clase compuesta "logística + riesgo no lexicalizado".
 */
const MAX_TRIVIAL_LENGTH = 120;

export function routeIntent(question: string, hasContext: boolean): ModelRoute {
  const n = normalize(question);

  // (1) Riesgo: premium SIEMPRE, antes que cualquier otra consideración. Atrapa
  // también la combinación rara "logística + riesgo descriptivo" (p. ej. una
  // pregunta de agenda que menciona que el paciente regaló sus cosas).
  if (RISK_KEYWORDS.test(n)) {
    return { intent: 'riesgo', tier: 'premium' };
  }

  // (2) Consulta LOGÍSTICA pura (corta y sin contenido clínico) → económico. Vale
  // con o sin contexto: un dato de agenda/contacto/saldo no necesita el modelo fuerte.
  if (n.length <= MAX_TRIVIAL_LENGTH && TRIVIAL_LOOKUP.test(n) && !CLINICAL_CONTENT.test(n)) {
    return { intent: 'trivial', tier: 'economico' };
  }

  // (2b) Sin un paciente recuperado: ayuda de plataforma no clínica (corta) → económico.
  if (!hasContext && n.length <= MAX_TRIVIAL_LENGTH && PLATFORM_HELP.test(n) && !CLINICAL_CONTENT.test(n)) {
    return { intent: 'plataforma', tier: 'economico' };
  }

  // (3) Default PREMIUM: razonamiento clínico Y riesgo eufemístico/indirecto que
  // ningún keyword matcher atrapa. Ante la duda, el modelo fuerte.
  return { intent: 'clinico', tier: 'premium' };
}

/** Candidatos de modelo acotados por el techo del plan (los arma la fábrica). */
export interface ModelCandidates {
  premium: string;
  economico: string;
  /**
   * Modelo premium REAL de la plataforma, SIN acotar por plan. Solo lo usa el
   * nivel de RIESGO: una pregunta de crisis nunca se sirve con el modelo débil,
   * ni siquiera cuando el plan (tope duro de Esencial, umbral suave superado)
   * degradó el techo a económico. Mismo precedente que PREMIUM_ALWAYS_KINDS en
   * AiBudgetGate (sugerencias_historia/borrador_reporte perforan el techo
   * consumiendo el presupuesto del plan): "el modelo fuerte donde el error
   * cuesta". El tope DURO agotado sigue bloqueando TODO (BlockedAssistantEngine),
   * así que esto no regala uso: solo decide CON QUÉ modelo se responde mientras
   * quede presupuesto.
   */
  riesgo: string;
}

/**
 * Resuelve el nombre de modelo concreto a partir del nivel ruteado y los
 * candidatos. RIESGO usa el premium real (perfora el techo del plan — ver
 * ModelCandidates.riesgo); para el resto, si el techo del plan es económico,
 * `premium === economico` y el nivel "premium" se queda en económico (el plan
 * manda).
 */
export function resolveRoutedModel(route: ModelRoute, candidates: ModelCandidates): string {
  if (route.intent === 'riesgo') return candidates.riesgo;
  return route.tier === 'premium' ? candidates.premium : candidates.economico;
}
