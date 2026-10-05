import {
  PaymentReminderTemplateRepository,
} from '../../domain/repositories/PaymentReminderTemplateRepository';
import {
  DEFAULT_PAYMENT_REMINDER_BODY,
  PAYMENT_REMINDER_TEMPLATE_NAME,
} from '../../domain/value-objects/paymentReminderTemplate';

export interface PaymentReminderTemplateView {
  name: string;
  body: string;
  /** true si el profesional ya personalizó su plantilla. */
  isOwn: boolean;
}

/**
 * Plantilla vigente del recordatorio de pago: la propia del profesional si
 * existe; si no, la integrada de la plataforma (v2-spec §6.13).
 */
export class GetPaymentReminderTemplate {
  public constructor(private readonly templates: PaymentReminderTemplateRepository) {}

  public async get(): Promise<PaymentReminderTemplateView> {
    const own = await this.templates.findOwn();
    if (own) return { name: own.name, body: own.body, isOwn: true };
    const builtin = await this.templates.findBuiltin();
    if (builtin) return { name: builtin.name, body: builtin.body, isOwn: false };
    return { name: PAYMENT_REMINDER_TEMPLATE_NAME, body: DEFAULT_PAYMENT_REMINDER_BODY, isOwn: false };
  }
}
