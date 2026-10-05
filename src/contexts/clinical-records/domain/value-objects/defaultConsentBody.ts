/**
 * Texto base de la plantilla de consentimiento informado (módulo PURO, lo
 * importa también el editor client-side para "restaurar texto base").
 *
 * Variables disponibles: {{paciente}}, {{profesional}}, {{cedula}}, {{fecha}}.
 * {{paciente}}, {{profesional}} y {{cedula}} se congelan en el snapshot al
 * emitir el consentimiento; {{fecha}} se resuelve al mostrar/firmar.
 */

export const DEFAULT_CONSENT_TITLE = 'Consentimiento informado para atención psicológica';

/**
 * Marcador estable de la cláusula de finalidad-IA. `IssuePatientConsent` marca el consentimiento
 * como autorizador de IA (ai_authorized=1) si el cuerpo del snapshot contiene este texto. Si el
 * profesional borra la cláusula de su plantilla, sus pacientes NO autorizan IA (fail-closed),
 * coherente con que su consentimiento ya no la cubre.
 *
 * El marcador es la FRASE AFIRMATIVA de la cláusula (encabezado + "autorizo"), no la mera mención
 * de la tecnología: con el marcador viejo ('inteligencia artificial' a secas), una plantilla
 * editada que NEGARA la finalidad ("NO autorizo el uso de inteligencia artificial…") activaba
 * ai_authorized=1 — exactamente lo contrario de lo firmado. Cualquier edición que rompa la frase
 * afirmativa cae del lado seguro: no autoriza. (Se compara en minúsculas.)
 */
export const AI_CONSENT_MARKER = 'asistencia por inteligencia artificial: autorizo';

export const DEFAULT_CONSENT_BODY = `Yo, {{paciente}}, en pleno uso de mis facultades, declaro que he sido informado(a) de manera clara, suficiente y comprensible sobre las condiciones del proceso de atención psicológica que iniciaré con {{profesional}}, profesional en psicología identificado(a) con cédula / tarjeta profesional {{cedula}}, y que con mi firma acepto libremente lo aquí descrito.

1. NATURALEZA Y PROPÓSITO DEL SERVICIO
La atención psicológica es un proceso profesional orientado a la evaluación, el acompañamiento y la intervención sobre mi salud mental y bienestar emocional. Comprendo que los resultados dependen de múltiples factores, que requieren mi participación activa y que el profesional no puede garantizar desenlaces específicos. El profesional se compromete a actuar conforme a los principios éticos y técnicos de su disciplina, y podrá remitirme a otro profesional o servicio cuando lo considere necesario para mi cuidado.

2. MODALIDAD DE ATENCIÓN Y TELEPSICOLOGÍA
Las sesiones podrán realizarse de forma presencial o a distancia (telepsicología) por videollamada u otros medios acordados. Para las sesiones virtuales entiendo que: (a) debo procurar un espacio privado y una conexión estable; (b) existen riesgos tecnológicos inherentes (interrupciones o fallas de la plataforma) que no dependen del profesional; (c) las sesiones NO serán grabadas por ninguna de las partes salvo acuerdo expreso, previo y por escrito; y (d) acordaremos un canal y un plan de contacto alternativo en caso de pérdida de comunicación o de una situación de urgencia durante la sesión.

3. CONFIDENCIALIDAD Y SUS LÍMITES
Todo lo tratado en las sesiones, así como mi historia clínica y registros asociados, es confidencial y está protegido por el secreto profesional. La información solo podrá ser revelada, en la medida estrictamente necesaria, en las siguientes excepciones: (a) riesgo inminente para mi vida o mi integridad, o para la de terceros; (b) sospecha o conocimiento de maltrato, abuso o vulneración de derechos de menores de edad o de personas en situación de especial protección; (c) requerimiento de autoridad judicial o administrativa competente conforme a la ley; y (d) supervisión o asesoría clínica entre profesionales, caso en el cual mi identidad se protegerá al máximo posible. Cuando alguna de estas excepciones deba aplicarse, el profesional procurará informármelo previamente, salvo que hacerlo agrave el riesgo.

4. TRATAMIENTO DE DATOS PERSONALES E HISTORIA CLÍNICA
Autorizo el tratamiento de mis datos personales y datos sensibles de salud con la única finalidad de prestar el servicio de atención psicológica, gestionar citas, recordatorios y comunicaciones del proceso, y cumplir los deberes legales de registro clínico. Entiendo y autorizo expresamente que esta información se almacene cifrada en servidores que pueden estar ubicados fuera de mi país (actualmente en Estados Unidos), bajo contratos que exigen confidencialidad y seguridad al proveedor. Este tratamiento se realiza conforme a la normativa de protección de datos aplicable en mi país (en Colombia, la Ley 1581 de 2012 y sus decretos reglamentarios — Habeas Data; en México, la Ley Federal de Protección de Datos Personales en Posesión de los Particulares — LFPDPPP; o la norma equivalente de mi jurisdicción). Conozco que tengo derecho a conocer, actualizar, rectificar y solicitar la supresión de mis datos, así como a revocar esta autorización, en los términos de la ley, y que la historia clínica se conserva bajo custodia del profesional durante los plazos legales aplicables.

Asistencia por INTELIGENCIA ARTIFICIAL: autorizo además que la información de mi proceso (incluidos datos sensibles de salud) pueda ser tratada por herramientas de inteligencia artificial con la ÚNICA finalidad de APOYAR al profesional —organizar y resumir lo registrado en mi expediente y sugerirle líneas de exploración—. Entiendo que: (a) la inteligencia artificial NO sustituye el juicio del profesional, NO emite diagnósticos ni decisiones, y el profesional sigue siendo el único responsable de mi atención; (b) este tratamiento puede implicar la transferencia de mis datos a un proveedor tecnológico ubicado fuera de mi país que actúa como encargado, sujeto a deberes de confidencialidad y seguridad; y (c) puedo revocar específicamente esta autorización de inteligencia artificial en cualquier momento, sin que ello afecte el resto de mi atención. Si no deseo esta finalidad, puedo solicitar al profesional un consentimiento sin esta cláusula.

5. DERECHOS DEL PACIENTE / CONSULTANTE
Tengo derecho a: (a) recibir un trato digno y respetuoso, sin discriminación; (b) recibir información clara sobre la evaluación, el plan de trabajo, las técnicas empleadas y las alternativas disponibles; (c) preguntar y recibir respuesta sobre cualquier aspecto del proceso; (d) conocer el costo de los servicios antes de iniciar; (e) solicitar remisión o una segunda opinión; y (f) presentar quejas o reclamos ante las instancias competentes.

6. VOLUNTARIEDAD Y REVOCACIÓN
Mi participación en este proceso es completamente voluntaria. Puedo negarme a responder preguntas, suspender una sesión o terminar el proceso en cualquier momento, sin que ello genere sanción alguna, y sin perjuicio de las obligaciones ya causadas (por ejemplo, honorarios de sesiones efectivamente prestadas). De igual forma, puedo revocar este consentimiento en cualquier momento comunicándolo al profesional; la revocación no afecta la licitud del tratamiento de datos previo a ella.

7. ACEPTACIÓN
Declaro que leí (o me fue leído) este documento, que comprendí su contenido, que pude formular preguntas y que estas fueron resueltas satisfactoriamente. En constancia, otorgo mi consentimiento informado el día {{fecha}}.`;

export type ConsentVariable = 'paciente' | 'profesional' | 'cedula' | 'fecha';

/**
 * Sustituye las variables {{token}} presentes en el cuerpo (tolerante a
 * espacios: {{ paciente }}). Solo reemplaza las variables provistas; las
 * demás quedan intactas para resolverse después.
 */
export function resolveConsentVariables(
  body: string,
  variables: Partial<Record<ConsentVariable, string>>,
): string {
  return body.replace(/\{\{\s*(paciente|profesional|cedula|fecha)\s*\}\}/g, (match, name: string) => {
    const value = variables[name as ConsentVariable];
    return value === undefined ? match : value;
  });
}
