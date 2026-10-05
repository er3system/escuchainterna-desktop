// Módulo puro (sin dependencias de Node): plantilla integrada del recordatorio
// de pago y su render con variables. Los client components (editor de plantilla)
// importan de aquí sin arrastrar módulos de Node al bundle.

export const PAYMENT_REMINDER_TEMPLATE_KEY = 'recordatorio_pago';

/** El nombre de la plantilla es fijo: editar el contenido NO la renombra. */
export const PAYMENT_REMINDER_TEMPLATE_NAME = 'Recordatorio de pago';

export interface PaymentReminderTemplateData {
  paciente: string;
  profesional: string;
  fecha: string;
  hora: string;
  monto: string;
  liga_pago: string;
  politicas: string;
}

export const PAYMENT_REMINDER_PLACEHOLDERS: Array<{
  token: keyof PaymentReminderTemplateData;
  description: string;
}> = [
  { token: 'paciente', description: 'Nombre del paciente' },
  { token: 'profesional', description: 'Tu nombre profesional' },
  { token: 'fecha', description: 'Fecha de la sesión (DD/MM/AAAA)' },
  { token: 'hora', description: 'Hora de la sesión' },
  { token: 'monto', description: 'Monto pendiente con moneda' },
  { token: 'liga_pago', description: 'Liga de pago' },
  { token: 'politicas', description: 'Tus políticas de pago' },
];

export const DEFAULT_PAYMENT_REMINDER_BODY = [
  '💳 Recordatorio de pago',
  'Hola {{paciente}}, tienes un pago pendiente de tu sesión con *{{profesional}}*.',
  '',
  '*Detalles del pago*',
  '🗓️ *Sesión:* {{fecha}} {{hora}}',
  '💵 *Monto:* {{monto}}',
  '🔗 *Liga de pago:* {{liga_pago}}',
  '',
  '{{politicas}}',
  '',
  'Mensaje automatizado: no responder a este mensaje.',
].join('\n');

/**
 * Sustituye las variables {{token}} de la plantilla y limpia los saltos de
 * línea sobrantes cuando una variable (p. ej. políticas) viene vacía.
 */
export function renderPaymentReminderTemplate(
  body: string,
  data: PaymentReminderTemplateData,
): string {
  let rendered = body;
  for (const [token, value] of Object.entries(data)) {
    rendered = rendered.split(`{{${token}}}`).join(value);
  }
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}
