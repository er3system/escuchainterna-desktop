import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

/** Marca UNA notificación como leída (solo si pertenece al destinatario). */
export class MarkNotificationRead {
  public constructor(private readonly notifications: NotificationRepository) {}

  public mark(recipientUserId: string, notificationId: string): Promise<void> {
    return this.notifications.markRead(recipientUserId, notificationId, new Date().toISOString());
  }
}
