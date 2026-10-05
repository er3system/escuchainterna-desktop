import type { AnnouncementRepository } from '../../domain/repositories/AnnouncementRepository';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

/**
 * Contador de no leídas para el badge de la campana. También materializa las
 * novedades pendientes (fan-out perezoso, idempotente) para que el contador
 * no mienta cuando hay announcements aún no convertidos en notificación.
 */
export class CountUnreadNotifications {
  public constructor(
    private readonly notifications: NotificationRepository,
    private readonly announcements: AnnouncementRepository,
  ) {}

  public async count(recipientUserId: string): Promise<number> {
    await this.announcements.fanOutPendingFor(recipientUserId);
    return this.notifications.countUnread(recipientUserId, new Date().toISOString());
  }
}
