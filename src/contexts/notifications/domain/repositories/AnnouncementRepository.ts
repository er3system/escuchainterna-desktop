import type { Announcement, AnnouncementAudience } from '../Announcement';

export interface NewAnnouncement {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  createdBy: string;
}

/**
 * Novedades del admin (v3 §12). El fan-out a `notifications` es PEREZOSO:
 * se materializa por usuario al consultar su campana, de forma idempotente.
 */
export interface AnnouncementRepository {
  publish(announcement: NewAnnouncement): Promise<string>;
  listAll(): Promise<Announcement[]>;
  /**
   * Crea (idempotente) las notificaciones de las novedades que apliquen al
   * usuario según la audiencia y que sean posteriores a su registro.
   */
  fanOutPendingFor(userId: string): Promise<void>;
  /** Borra la novedad y todas sus notificaciones materializadas (nov:<id>:*). */
  delete(announcementId: string): Promise<void>;
}
