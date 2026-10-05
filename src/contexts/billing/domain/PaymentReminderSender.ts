import { PaymentReminder } from './PaymentReminder';

/**
 * Puerto de salida para entregar recordatorios de pago.
 * El adaptador local escribe en el outbox (canal WhatsApp).
 */
export interface PaymentReminderSender {
  send(reminder: PaymentReminder): Promise<void>;
}
