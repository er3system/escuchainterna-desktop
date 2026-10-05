/**
 * Estado de los CANALES externos (correo, WhatsApp, pagos, IA). Fuente ÚNICA de
 * verdad sobre si un proveedor real está conectado: cada canal se activa con su
 * variable de entorno. Mientras no exista la clave, el canal opera en modo
 * simulado (el outbox/registro in-app es el respaldo). Así, "conectar el canal"
 * = definir una variable de entorno, sin tocar código.
 *
 * Los nombres de las variables coinciden con docs/proveedores y .env.example.
 */

export interface ChannelStatus {
  /** ¿Hay un proveedor real conectado? */
  configured: boolean;
  /** Proveedor previsto (para mostrar en UI/admin). */
  provider: string;
  /** Variables de entorno que activan el canal. */
  envVars: string[];
}

/** Correo transaccional: recordatorios, recuperación de contraseña, facturas, consentimientos. */
export function emailChannel(): ChannelStatus {
  return {
    configured: Boolean(process.env.RESEND_API_KEY?.trim()),
    provider: 'Resend',
    envVars: ['RESEND_API_KEY', 'EMAIL_FROM'],
  };
}

/** WhatsApp Business Cloud API: recordatorios y notificaciones por WhatsApp. */
export function whatsappChannel(): ChannelStatus {
  return {
    configured: Boolean(
      process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    ),
    provider: 'WhatsApp Business Cloud API',
    envVars: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  };
}

/** Pasarela de cobro de la suscripción del profesional. */
export function paymentsChannel(): ChannelStatus {
  return {
    configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    provider: 'Stripe',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  };
}

/** Asistente de IA (Anthropic). Sin clave, el motor usa el adaptador local. */
export function aiChannel(): ChannelStatus {
  return {
    configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    provider: 'Anthropic',
    envVars: ['ANTHROPIC_API_KEY'],
  };
}

/** Remitente de los correos transaccionales (configurable; con respaldo por defecto). */
export const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || 'EscuchaInterna <no-reply@escuchainterna.com>';

/** Resumen de todos los canales (para un panel de estado en /admin). */
export function allChannels(): Array<{ key: string; label: string } & ChannelStatus> {
  return [
    { key: 'email', label: 'Correo transaccional', ...emailChannel() },
    { key: 'whatsapp', label: 'WhatsApp', ...whatsappChannel() },
    { key: 'payments', label: 'Pasarela de cobro', ...paymentsChannel() },
    { key: 'ai', label: 'Asistente de IA', ...aiChannel() },
  ];
}
