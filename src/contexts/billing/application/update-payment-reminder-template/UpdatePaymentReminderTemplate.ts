import {
  PaymentReminderTemplateRepository,
} from '../../domain/repositories/PaymentReminderTemplateRepository';
import { UpdatePaymentReminderTemplateMessage } from './UpdatePaymentReminderTemplateMessage';

/**
 * Edita el CONTENIDO de la plantilla `recordatorio_pago` del profesional
 * (la crea a partir de la integrada si no existe; el nombre no cambia).
 */
export class UpdatePaymentReminderTemplate {
  public constructor(private readonly templates: PaymentReminderTemplateRepository) {}

  public async update(message: UpdatePaymentReminderTemplateMessage): Promise<void> {
    await this.templates.saveOwn(message.body());
  }
}
