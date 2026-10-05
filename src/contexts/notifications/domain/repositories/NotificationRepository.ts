import type { NewNotification, NotificationItem } from '../Notification';

/**
 * Persistencia de notificaciones in-app (v3 §12). Todas las lecturas filtran
 * por destinatario y por visibilidad: un recordatorio programado solo existe
 * para el usuario a partir de su `remind_at`.
 */
export interface NotificationRepository {
  insert(notification: NewNotification): Promise<void>;
  /**
   * Inserta con id determinista e ignora duplicados — es la base del fan-out
   * perezoso de novedades (idempotente por announcement+usuario).
   */
  insertIdempotent(id: string, notification: NewNotification): Promise<void>;
  /** Visibles para el usuario (remind_at vencido o nulo), recientes primero. */
  listVisibleFor(recipientUserId: string, nowIso: string, limit: number): Promise<NotificationItem[]>;
  /** Recordatorios PROGRAMADOS a futuro (remind_at > ahora) de un paciente, próximos primero. */
  listScheduledForPatient(
    recipientUserId: string,
    patientId: string,
    nowIso: string,
    limit: number,
  ): Promise<NotificationItem[]>;
  /** Recordatorios propios próximos (kind='recordatorio', a futuro o sin fecha), próximos primero. */
  listUpcomingReminders(
    recipientUserId: string,
    nowIso: string,
    limit: number,
  ): Promise<NotificationItem[]>;
  countUnread(recipientUserId: string, nowIso: string): Promise<number>;
  /** Marca leída SOLO si pertenece al destinatario. */
  markRead(recipientUserId: string, notificationId: string, nowIso: string): Promise<void>;
  /** Marca leídas todas las VISIBLES (los recordatorios futuros quedan intactos). */
  markAllRead(recipientUserId: string, nowIso: string): Promise<void>;
}
