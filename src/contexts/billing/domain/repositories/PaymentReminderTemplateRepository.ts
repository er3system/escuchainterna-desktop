/**
 * Plantilla del recordatorio de pago del profesional (message_templates,
 * template_key `recordatorio_pago`). El nombre es fijo: solo se edita el
 * contenido (v2-spec §6.13).
 */
export interface PaymentReminderTemplateContent {
  name: string;
  body: string;
}

export interface PaymentReminderTemplateRepository {
  /** Plantilla propia del profesional (owner_user_id), si ya la personalizó. */
  findOwn(): Promise<PaymentReminderTemplateContent | null>;
  /** Plantilla base de la plataforma (owner NULL), si está sembrada. */
  findBuiltin(): Promise<PaymentReminderTemplateContent | null>;
  /** Guarda el contenido propio; la crea a partir de la integrada si no existe. */
  saveOwn(body: string): Promise<void>;
}
