import { ListNotifications } from '../application/list-notifications/ListNotifications';
import { CountUnreadNotifications } from '../application/count-unread/CountUnreadNotifications';
import { MarkNotificationRead } from '../application/mark-read/MarkNotificationRead';
import { MarkAllNotificationsRead } from '../application/mark-read/MarkAllNotificationsRead';
import { CreateReminder } from '../application/create-reminder/CreateReminder';
import { PublishAnnouncement } from '../application/publish-announcement/PublishAnnouncement';
import { SendOrgNotice } from '../application/send-org-notice/SendOrgNotice';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { SqliteNotificationRepository } from './persistence/SqliteNotificationRepository';
import { SqliteAnnouncementRepository } from './persistence/SqliteAnnouncementRepository';

/**
 * Composición del contexto notifications (v3 §12): campana, página
 * /notificaciones, recordatorios propios, novedades del admin (fan-out
 * perezoso) y avisos de organización.
 */
export function createNotificationUseCases() {
  const db = getDatabaseAdapter();
  const notifications = new SqliteNotificationRepository(db);
  const announcements = new SqliteAnnouncementRepository(db);

  return {
    listNotifications: new ListNotifications(notifications, announcements),
    countUnread: new CountUnreadNotifications(notifications, announcements),
    markNotificationRead: new MarkNotificationRead(notifications),
    markAllNotificationsRead: new MarkAllNotificationsRead(notifications),
    createReminder: new CreateReminder(notifications),
    publishAnnouncement: new PublishAnnouncement(announcements),
    sendOrgNotice: new SendOrgNotice(notifications),
    listAnnouncements: () => announcements.listAll(),
    deleteAnnouncement: (announcementId: string) => announcements.delete(announcementId),
  };
}
