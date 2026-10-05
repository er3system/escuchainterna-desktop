import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

/**
 * "Marcar todas como leídas" de la campana: solo toca las notificaciones
 * VISIBLES — un recordatorio programado a futuro sigue sin leer hasta vencer.
 */
export class MarkAllNotificationsRead {
  public constructor(private readonly notifications: NotificationRepository) {}

  public markAll(recipientUserId: string): Promise<void> {
    return this.notifications.markAllRead(recipientUserId, new Date().toISOString());
  }
}
