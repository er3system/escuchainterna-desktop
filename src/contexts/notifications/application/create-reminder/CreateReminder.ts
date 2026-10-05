import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';
import { CreateReminderMessage } from './CreateReminderMessage';

/**
 * Crea un recordatorio propio (kind 'recordatorio') para cada destinatario:
 * el usuario que lo crea y, cuando es un asistente, también su titular —
 * ambos lo ven en su campana desde `remind_at` (v3 §12).
 */
export class CreateReminder {
  public constructor(private readonly notifications: NotificationRepository) {}

  public async create(message: CreateReminderMessage): Promise<void> {
    const patientId = message.patientId();
    for (const recipientUserId of message.recipientUserIds()) {
      await this.notifications.insert({
        recipientUserId,
        kind: 'recordatorio',
        title: message.title(),
        body: message.body(),
        link: patientId ? `/pacientes/${patientId}` : '',
        patientId,
        remindAt: message.remindAt(),
        createdBy: message.createdByUserId(),
      });
    }
  }
}
