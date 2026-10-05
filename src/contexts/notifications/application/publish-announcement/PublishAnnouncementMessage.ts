import { isAnnouncementAudience, type AnnouncementAudience } from '../../domain/Announcement';
import { InvalidNotificationContentError } from '../../domain/errors/InvalidNotificationContentError';

/** Novedad del admin (v3 §12): título obligatorio, audiencia válida. */
export class PublishAnnouncementMessage {
  private readonly announcementTitle: string;
  private readonly announcementBody: string;
  private readonly announcementAudience: AnnouncementAudience;
  private readonly author: string;

  public constructor(input: { title: string; body?: string; audience: string; createdBy: string }) {
    this.announcementTitle = input.title.trim();
    if (!this.announcementTitle) {
      throw new InvalidNotificationContentError('El título de la novedad es obligatorio.');
    }
    this.announcementBody = (input.body ?? '').trim();
    const audience = input.audience.trim();
    if (!isAnnouncementAudience(audience)) {
      throw new InvalidNotificationContentError('La audiencia de la novedad no es válida.');
    }
    this.announcementAudience = audience;
    this.author = input.createdBy;
  }

  public title(): string {
    return this.announcementTitle;
  }

  public body(): string {
    return this.announcementBody;
  }

  public audience(): AnnouncementAudience {
    return this.announcementAudience;
  }

  public createdBy(): string {
    return this.author;
  }
}
