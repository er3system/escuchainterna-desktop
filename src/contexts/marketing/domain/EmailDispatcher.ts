export type MarketingEmailTemplate = 'correo_masivo' | 'cumpleanios' | 'reactivacion';

export interface MarketingEmail {
  template: MarketingEmailTemplate;
  patientId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
}

/**
 * Puerto de salida de correos de marketing. En local el adaptador escribe en
 * el outbox compartido (no envía nada real); un adaptador SMTP lo sustituirá
 * sin tocar dominio ni UI.
 */
export interface EmailDispatcher {
  dispatch(email: MarketingEmail): Promise<void>;
}
