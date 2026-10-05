/**
 * Catálogo de proveedores de PLATAFORMA (los configura solo el admin; los
 * psicólogos nunca los ven). Módulo puro: sin dependencias de Node.
 */

export interface ProviderFieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export interface ProviderSpec {
  id: string;
  name: string;
  description: string;
  fields: ProviderFieldSpec[];
}

export const PLATFORM_PROVIDERS: ProviderSpec[] = [
  {
    id: 'whatsapp_business',
    name: 'WhatsApp Business',
    description:
      'Cuenta empresa (WhatsApp Business Cloud API) desde la que salen recordatorios y mensajes a pacientes.',
    fields: [
      { key: 'phone_number_id', label: 'Phone number ID', placeholder: '1234567890' },
      { key: 'business_account_id', label: 'Business account ID', placeholder: 'WABA ID' },
      { key: 'access_token', label: 'Access token', placeholder: 'EAAG…', secret: true },
    ],
  },
  {
    id: 'email_transaccional',
    name: 'Email transaccional',
    description: 'Resend (o SMTP) con dominio verificado y DKIM para los correos de la plataforma.',
    fields: [
      { key: 'resend_api_key', label: 'Resend API key', placeholder: 're_…', secret: true },
      { key: 'from_email', label: 'Remitente', placeholder: 'hola@escuchainterna.com' },
      { key: 'smtp_host', label: 'SMTP host (alternativo)', placeholder: 'smtp.ejemplo.com' },
    ],
  },
  {
    id: 'ia',
    name: 'IA (Anthropic)',
    description:
      'Modelo del asistente y de las sugerencias clínicas. Es de la plataforma: los psicólogos no configuran modelos.',
    fields: [
      { key: 'anthropic_api_key', label: 'API key de Anthropic', placeholder: 'sk-ant-…', secret: true },
      { key: 'model', label: 'Modelo', placeholder: 'claude-sonnet-5' },
    ],
  },
  {
    id: 'pasarela_suscripciones',
    name: 'Pasarela de suscripciones (Stripe)',
    description: 'Stripe Billing para cobrar la suscripción mensual de los profesionales.',
    fields: [
      { key: 'stripe_secret_key', label: 'Secret key', placeholder: 'sk_live_…', secret: true },
      { key: 'stripe_webhook_secret', label: 'Webhook secret', placeholder: 'whsec_…', secret: true },
      { key: 'price_id', label: 'Price ID del plan', placeholder: 'price_…' },
    ],
  },
  {
    id: 'almacenamiento',
    name: 'Almacenamiento',
    description: 'Dónde viven archivos de pacientes y logos en producción (S3 compatible; en local, disco).',
    fields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://s3.amazonaws.com' },
      { key: 'bucket', label: 'Bucket', placeholder: 'escuchainterna-archivos' },
      { key: 'access_key_id', label: 'Access key ID' },
      { key: 'secret_access_key', label: 'Secret access key', secret: true },
    ],
  },
];
