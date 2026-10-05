import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';
import { SendOrgNoticeMessage } from './SendOrgNoticeMessage';

/**
 * Envía un aviso de organización (kind 'aviso_org') a los miembros
 * seleccionados: fechas de corte, entregas, recordatorios académicos…
 * Se materializa de inmediato (sin fan-out perezoso).
 */
export class SendOrgNotice {
  public constructor(private readonly notifications: NotificationRepository) {}

  public async send(message: SendOrgNoticeMessage): Promise<number> {
    for (const recipientUserId of message.recipientUserIds()) {
      await this.notifications.insert({
        recipientUserId,
        kind: 'aviso_org',
        title: message.title(),
        body: message.body(),
        link: '/notificaciones',
        createdBy: message.senderUserId(),
      });
    }
    return message.recipientUserIds().length;
  }
}
