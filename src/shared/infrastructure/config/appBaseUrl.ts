/**
 * URL base pública de la app, usada para construir ligas que viajan en
 * mensajes (WhatsApp/correo): liga de pago de sesiones, links de reserva, etc.
 *
 * Configurable con la variable de entorno APP_BASE_URL (con respaldo en la
 * APP_URL ya usada por identidad/marketing). En local: http://localhost:3000.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
