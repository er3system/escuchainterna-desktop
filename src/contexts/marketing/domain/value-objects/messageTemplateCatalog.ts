/**
 * Catálogo de plantillas de mensajes integradas (módulo PURO: importable
 * desde client components). Estas son las plantillas "de fábrica"; el
 * profesional puede personalizar el contenido de cada una (message_templates
 * con su owner_user_id) sin renombrarlas. "Restaurar original" borra la
 * personalización y vuelve a estos textos.
 */

export type MessageTemplateKind = 'notificacion' | 'automatizacion' | 'marketing';
export type MessageTemplateChannel = 'whatsapp' | 'email';

export interface MessageTemplateDefinition {
  key: string;
  name: string;
  kind: MessageTemplateKind;
  channel: MessageTemplateChannel;
  description: string;
  subject: string;
  body: string;
  /** Tokens disponibles en esta plantilla (sin llaves). */
  variables: string[];
}

export interface TemplateVariableDoc {
  token: string;
  description: string;
}

export const TEMPLATE_VARIABLE_DOCS: TemplateVariableDoc[] = [
  { token: 'nombre', description: 'Nombre del paciente' },
  { token: 'profesional', description: 'Tu nombre (perfil profesional)' },
  { token: 'fecha', description: 'Fecha de la sesión' },
  { token: 'hora', description: 'Hora de la sesión' },
  { token: 'duracion', description: 'Duración de la sesión' },
  { token: 'modalidad', description: 'Presencial o en línea' },
  { token: 'ubicacion', description: 'Dirección del consultorio o liga de la videollamada' },
  { token: 'liga_sesion', description: 'Liga de la videollamada (sesiones en línea)' },
  { token: 'monto', description: 'Monto de la sesión o del pago' },
  { token: 'liga_pago', description: 'Liga de pago de la sesión' },
  { token: 'liga_agenda', description: 'Liga pública para agendar una sesión contigo' },
  { token: 'politicas', description: 'Tus políticas de pago y cancelación' },
  { token: 'folio', description: 'Folio del recibo' },
];

const AUTOMATED_FOOTER = 'Mensaje automatizado: no responder a este mensaje.';

const SESSION_VARIABLES = [
  'nombre',
  'profesional',
  'fecha',
  'hora',
  'duracion',
  'modalidad',
  'ubicacion',
  'liga_sesion',
  'monto',
  'liga_pago',
  'politicas',
];

const MARKETING_VARIABLES = ['nombre', 'profesional', 'liga_agenda'];

export const MESSAGE_TEMPLATE_CATALOG: MessageTemplateDefinition[] = [
  // ===== Notificaciones de sesiones (scheduling) =====
  {
    key: 'sesion_agendada',
    name: 'Sesión agendada',
    kind: 'notificacion',
    channel: 'whatsapp',
    description: 'Se envía al paciente cuando se agenda una sesión (WhatsApp y correo).',
    subject: 'Sesión agendada',
    body: `✅ Sesión agendada
Ha agendado una sesión con *{{profesional}}*.

*Detalles de la sesión*
📅 *Fecha:* {{fecha}}
⏰ *Hora:* {{hora}}
⏳ *Duración:* {{duracion}}
📍 *Modalidad:* {{modalidad}}
📍 *Ubicación:* {{ubicacion}}

${AUTOMATED_FOOTER}`,
    variables: SESSION_VARIABLES,
  },
  {
    key: 'sesion_reagendada',
    name: 'Sesión reagendada',
    kind: 'notificacion',
    channel: 'whatsapp',
    description: 'Se envía al paciente cuando una sesión cambia de fecha u hora.',
    subject: 'Sesión reagendada',
    body: `🔄 Sesión reagendada
Su sesión con *{{profesional}}* ha cambiado de fecha y hora.

*Nuevos detalles de la sesión*
📅 *Fecha:* {{fecha}}
⏰ *Hora:* {{hora}}
⏳ *Duración:* {{duracion}}
📍 *Modalidad:* {{modalidad}}
📍 *Ubicación:* {{ubicacion}}

${AUTOMATED_FOOTER}`,
    variables: SESSION_VARIABLES,
  },
  {
    key: 'sesion_cancelada',
    name: 'Sesión cancelada',
    kind: 'notificacion',
    channel: 'whatsapp',
    description: 'Se envía al paciente cuando se cancela una sesión.',
    subject: 'Sesión cancelada',
    body: `❌ Sesión cancelada
Su sesión con *{{profesional}}* ha sido cancelada.

*Detalles de la sesión cancelada*
📅 *Fecha:* {{fecha}}
⏰ *Hora:* {{hora}}

${AUTOMATED_FOOTER}`,
    variables: ['nombre', 'profesional', 'fecha', 'hora'],
  },
  {
    key: 'recordatorio_sesion',
    name: 'Recordatorio de sesión',
    kind: 'notificacion',
    channel: 'whatsapp',
    description: 'Recordatorio automático antes de cada sesión.',
    subject: 'Recordatorio de sesión',
    body: `⏰ Recordatorio de sesión
Hola {{nombre}}, te recordamos tu sesión con *{{profesional}}*.

*Detalles de la sesión*
📅 *Fecha:* {{fecha}}
⏰ *Hora:* {{hora}}
⏳ *Duración:* {{duracion}}
📍 *Modalidad:* {{modalidad}}
📍 *Ubicación:* {{ubicacion}}

${AUTOMATED_FOOTER}`,
    variables: SESSION_VARIABLES,
  },
  // ===== Pagos (billing) =====
  {
    key: 'recordatorio_pago',
    name: 'Recordatorio de pago',
    kind: 'notificacion',
    channel: 'whatsapp',
    description: 'Se envía cuando una sesión tiene pago pendiente.',
    subject: 'Recordatorio de pago',
    body: `💳 Recordatorio de pago
Hola {{nombre}}, tienes un pago pendiente de tu sesión con *{{profesional}}*.

*Detalles del pago*
🗓️ *Sesión:* {{fecha}} {{hora}}
💵 *Monto:* {{monto}}
🔗 *Liga de pago:* {{liga_pago}}

{{politicas}}

${AUTOMATED_FOOTER}`,
    variables: ['nombre', 'profesional', 'fecha', 'hora', 'monto', 'liga_pago', 'politicas'],
  },
  {
    // La clave interna 'factura' se conserva; los textos visibles dicen "Recibo" (v3 §7).
    key: 'factura',
    name: 'Recibo',
    kind: 'notificacion',
    channel: 'email',
    description: 'Correo con el detalle de la sesión pagada y su folio.',
    subject: 'Recibo {{folio}} — sesión del {{fecha}}',
    body: `Hola {{nombre}},

Te comparto el recibo de tu sesión:

Folio: {{folio}}
Sesión: {{fecha}} {{hora}}
Monto: {{monto}}
Atendió: {{profesional}}

Si necesitas datos fiscales adicionales o detectas algún error, respóndeme por este medio.

Gracias por tu confianza,
{{profesional}}`,
    variables: ['nombre', 'profesional', 'fecha', 'hora', 'monto', 'folio'],
  },
  // ===== Automatizaciones (marketing) =====
  {
    key: 'cumpleanios',
    name: 'Felicitación de cumpleaños',
    kind: 'automatizacion',
    channel: 'email',
    description: 'Correo automático el día del cumpleaños de cada paciente.',
    subject: '¡Feliz cumpleaños, {{nombre}}! 🎂',
    body: `Hola {{nombre}},

Te deseo un muy feliz cumpleaños. Que este nuevo año de vida venga lleno de bienestar.

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'reactivacion',
    name: 'Reactivación',
    kind: 'automatizacion',
    channel: 'email',
    description: 'Correo automático para pacientes sin sesiones recientes.',
    subject: '¿Cómo has estado, {{nombre}}?',
    body: `Hola {{nombre}},

Me acordé de ti y quería saber cómo va todo. Si te gustaría retomar un espacio para ti, aquí te dejo mi liga para agendar: {{liga_agenda}}

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  // ===== Marketing (correo masivo) =====
  {
    key: 'fidelizacion',
    name: 'Fidelización',
    kind: 'marketing',
    channel: 'email',
    description: 'Agradece la confianza y deja la puerta abierta.',
    subject: 'Gracias por confiar en este espacio, {{nombre}}',
    body: `Hola {{nombre}},

Quería agradecerte por la confianza que has puesto en este proceso. Acompañarte ha sido un privilegio y quiero que sepas que este espacio sigue siendo tuyo.

Si conoces a alguien que pueda beneficiarse de un acompañamiento psicológico, puedes compartirle mi liga para agendar una primera sesión: {{liga_agenda}}

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'ejercicio_complementario',
    name: 'Ejercicio complementario',
    kind: 'marketing',
    channel: 'email',
    description: 'Comparte un ejercicio breve entre sesiones.',
    subject: 'Un ejercicio breve para esta semana, {{nombre}}',
    body: `Hola {{nombre}},

Te comparto un ejercicio breve para acompañar lo que hemos trabajado en sesión:

1. Dedica 5 minutos al día a respirar de forma consciente: inhala en 4 tiempos, sostén 4 y exhala en 6.
2. Anota una situación que te haya movido emocionalmente y qué pensamiento la acompañó.
3. Antes de dormir, escribe una cosa por la que te sientas agradecido/a.

No hay forma correcta o incorrecta de hacerlo; lo importante es darte el espacio. Si quieres que lo revisemos juntos, agenda tu siguiente sesión aquí: {{liga_agenda}}

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'reconexion',
    name: 'Reconexión',
    kind: 'marketing',
    channel: 'email',
    description: 'Invita con calidez a retomar el proceso.',
    subject: '¿Cómo has estado, {{nombre}}?',
    body: `Hola {{nombre}},

Ha pasado un tiempo desde nuestra última sesión y quería saber cómo has estado. A veces la rutina nos aleja de los espacios que nos hacen bien, y está bien retomarlos cuando lo sintamos necesario.

Si te gustaría volver a darte ese momento, aquí te dejo mi liga para agendar: {{liga_agenda}}

Sin prisa y sin presión: este espacio sigue abierto para ti.

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'bienvenida',
    name: 'Bienvenida a nuevo paciente',
    kind: 'marketing',
    channel: 'email',
    description: 'Da la bienvenida y explica el encuadre inicial.',
    subject: 'Bienvenido/a a este espacio, {{nombre}}',
    body: `Hola {{nombre}},

Quiero darte la bienvenida a este proceso. Dar el primer paso no siempre es fácil, y me alegra que hayas decidido darte este espacio.

Algunas cosas que pueden ayudarte a empezar:
• Llega unos minutos antes para acomodarte con calma.
• No necesitas preparar nada: trabajaremos con lo que traigas ese día.
• Cualquier duda sobre horarios o pagos, escríbeme con confianza.

Si necesitas agendar o mover tu sesión, puedes hacerlo aquí: {{liga_agenda}}

Nos vemos pronto,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'seguimiento_post_alta',
    name: 'Seguimiento post-alta',
    kind: 'marketing',
    channel: 'email',
    description: 'Acompaña al paciente tiempo después del cierre del proceso.',
    subject: '¿Cómo va todo, {{nombre}}?',
    body: `Hola {{nombre}},

Ha pasado un tiempo desde que cerramos tu proceso y quería saber cómo te ha ido. Cerrar un acompañamiento no significa que el camino termine: significa que ahora cuentas con más herramientas para recorrerlo.

Si en algún momento sientes que te haría bien una sesión de seguimiento, este espacio sigue disponible para ti: {{liga_agenda}}

Te deseo lo mejor,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'referidos',
    name: 'Recomendación / referidos',
    kind: 'marketing',
    channel: 'email',
    description: 'Invita a recomendar tu consulta a conocidos.',
    subject: '¿Conoces a alguien que necesite este espacio?',
    body: `Hola {{nombre}},

Gran parte de las personas que llegan a terapia lo hacen porque alguien de confianza les recomendó dar el paso.

Si conoces a alguien que esté pasando por un momento difícil o que quiera trabajar en sí mismo/a, puedes compartirle mi liga para agendar una primera sesión: {{liga_agenda}}

Gracias por ayudar a que más personas se den este espacio.

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'fechas_especiales',
    name: 'Fechas especiales',
    kind: 'marketing',
    channel: 'email',
    description: 'Saluda en fin de año, festividades o fechas significativas.',
    subject: 'Un saludo en estas fechas, {{nombre}}',
    body: `Hola {{nombre}},

En estas fechas quería enviarte un saludo y recordarte que cuidar de ti también es una forma de celebrar.

Las épocas señaladas pueden mover emociones de todo tipo: alegría, nostalgia, estrés… Todas son válidas. Si sientes que te haría bien un espacio para procesarlas, aquí estoy: {{liga_agenda}}

Que estos días te traten con amabilidad.

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'encuesta_satisfaccion',
    name: 'Encuesta de satisfacción',
    kind: 'marketing',
    channel: 'email',
    description: 'Pide retroalimentación sobre el acompañamiento.',
    subject: 'Tu opinión me ayuda a acompañarte mejor, {{nombre}}',
    body: `Hola {{nombre}},

Tu experiencia en este proceso es lo más importante para mí, y me ayudaría mucho conocer tu opinión.

¿Podrías responderme estas tres preguntas? Basta con contestar este correo:

1. ¿Qué es lo que más te ha servido del acompañamiento?
2. ¿Hay algo que cambiarías o que te gustaría diferente?
3. Del 1 al 10, ¿qué tanto recomendarías este espacio?

Gracias por tu tiempo y tu honestidad.

Un abrazo,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'taller_grupo',
    name: 'Invitación a taller o grupo',
    kind: 'marketing',
    channel: 'email',
    description: 'Invita a talleres, grupos terapéuticos o charlas.',
    subject: 'Te invito a un taller, {{nombre}}',
    body: `Hola {{nombre}},

Quiero invitarte a un taller que estoy organizando y que creo que puede interesarte.

[Describe aquí el tema, la fecha, el horario y el costo del taller.]

El trabajo en grupo tiene algo especial: escuchar otras experiencias nos recuerda que no estamos solos en lo que sentimos.

Si te interesa, respóndeme este correo o agenda directamente aquí: {{liga_agenda}}

Te espero,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
  {
    key: 'cambio_horarios',
    name: 'Cambio de horarios',
    kind: 'marketing',
    channel: 'email',
    description: 'Avisa cambios de disponibilidad, vacaciones o nueva dirección.',
    subject: 'Aviso importante sobre mis horarios, {{nombre}}',
    body: `Hola {{nombre}},

Te escribo para avisarte de un cambio en mi disponibilidad:

[Describe aquí el cambio: nuevos horarios, periodo de vacaciones, cambio de consultorio…]

Si este cambio afecta alguna de tus sesiones agendadas, escríbeme y buscamos juntos un nuevo horario. También puedes reagendar directamente aquí: {{liga_agenda}}

Gracias por tu comprensión,
{{profesional}}`,
    variables: MARKETING_VARIABLES,
  },
];

export function findTemplateDefinition(key: string): MessageTemplateDefinition | undefined {
  return MESSAGE_TEMPLATE_CATALOG.find((template) => template.key === key);
}

/**
 * Sustituye los tokens {{token}} de un contenido de plantilla y limpia los
 * saltos de línea sobrantes cuando alguna variable viene vacía. Función pura.
 */
export function renderTemplateContent(content: string, variables: Record<string, string>): string {
  let rendered = content;
  for (const [token, value] of Object.entries(variables)) {
    rendered = rendered.split(`{{${token}}}`).join(value);
  }
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

/** Datos de ejemplo para las vistas previas de plantillas y temas de correo. */
export const SAMPLE_TEMPLATE_VARIABLES: Record<string, string> = {
  nombre: 'María',
  profesional: 'Psic. Ana Torres',
  fecha: 'lunes 12 de junio de 2026',
  hora: '10:00 am',
  duracion: '50 min',
  modalidad: 'En línea',
  ubicacion: 'https://meet.escuchainterna.local/sesion',
  liga_sesion: 'https://meet.escuchainterna.local/sesion',
  monto: '$ 80.000 COP',
  liga_pago: 'https://pay.escuchainterna.local/demo',
  liga_agenda: 'https://escuchainterna.local/reservar/demo',
  politicas: 'Pago dentro de las 24 horas posteriores a la sesión.',
  folio: 'EI-2026-001',
};
