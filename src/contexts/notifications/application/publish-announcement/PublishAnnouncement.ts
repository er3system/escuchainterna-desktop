import type { AnnouncementRepository } from '../../domain/repositories/AnnouncementRepository';
import { PublishAnnouncementMessage } from './PublishAnnouncementMessage';

/**
 * Publica una novedad de plataforma (solo admin — el guard vive en la ruta).
 * No hace fan-out aquí: cada usuario la materializa al abrir su campana.
 */
export class PublishAnnouncement {
  public constructor(private readonly announcements: AnnouncementRepository) {}

  public publish(message: PublishAnnouncementMessage): Promise<string> {
    return this.announcements.publish({
      title: message.title(),
      body: message.body(),
      audience: message.audience(),
      createdBy: message.createdBy(),
    });
  }
}
