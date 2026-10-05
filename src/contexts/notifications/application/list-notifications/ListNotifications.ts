import type { NotificationItem } from '../../domain/Notification';
import type { AnnouncementRepository } from '../../domain/repositories/AnnouncementRepository';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
}

/**
 * Feed de la campana y de /notificaciones: primero materializa (fan-out
 * perezoso e idempotente) las novedades pendientes del usuario y luego lista
 * las notificaciones visibles (recordatorios futuros excluidos).
 */
export class ListNotifications {
  public constructor(
    private readonly notifications: NotificationRepository,
    private readonly announcements: AnnouncementRepository,
  ) {}

  public async list(recipientUserId: string, limit = 50): Promise<NotificationFeed> {
    await this.announcements.fanOutPendingFor(recipientUserId);
    const nowIso = new Date().toISOString();
    return {
      items: await this.notifications.listVisibleFor(recipientUserId, nowIso, limit),
      unread: await this.notifications.countUnread(recipientUserId, nowIso),
    };
  }
}
