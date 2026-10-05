import { InvalidNotificationContentError } from '../../domain/errors/InvalidNotificationContentError';

/**
 * Aviso de organización (v3 §12): el org_master a sus miembros, el profesor
 * SOLO a sus supervisados. La capa de rutas valida que los destinatarios
 * pedidos pertenezcan al conjunto permitido ANTES de construir este mensaje.
 */
export class SendOrgNoticeMessage {
  private readonly noticeTitle: string;
  private readonly noticeBody: string;
  private readonly sender: string;
  private readonly recipients: string[];

  public constructor(input: {
    senderUserId: string;
    recipientUserIds: string[];
    title: string;
    body?: string;
  }) {
    this.noticeTitle = input.title.trim();
    if (!this.noticeTitle) {
      throw new InvalidNotificationContentError('El título del aviso es obligatorio.');
    }
    this.noticeBody = (input.body ?? '').trim();
    this.sender = input.senderUserId;

    const unique = [
      ...new Set(input.recipientUserIds.filter((id) => id.trim() !== '' && id !== input.senderUserId)),
    ];
    if (unique.length === 0) {
      throw new InvalidNotificationContentError('Selecciona al menos un destinatario para el aviso.');
    }
    this.recipients = unique;
  }

  public title(): string {
    return this.noticeTitle;
  }

  public body(): string {
    return this.noticeBody;
  }

  public senderUserId(): string {
    return this.sender;
  }

  public recipientUserIds(): string[] {
    return this.recipients;
  }
}
