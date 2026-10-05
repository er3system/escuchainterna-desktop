import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import type { PasswordResetNotification, PasswordResetNotifier } from '../../domain/PasswordResetNotifier';

/**
 * "Envía" el correo de recuperación registrándolo en el outbox local
 * (template recuperar_contrasena). En producción lo despacharía Resend.
 */
export class OutboxPasswordResetNotifier implements PasswordResetNotifier {
  public async sendResetLink(notification: PasswordResetNotification): Promise<void> {
    const greetingName = notification.fullName.trim() || 'profesional';
    await writeOutboxMessage({
      channel: 'email',
      recipient: notification.email,
      recipientName: notification.fullName,
      template: 'recuperar_contrasena',
      subject: 'Recupera tu contraseña de EscuchaInterna',
      body: [
        `Hola ${greetingName},`,
        '',
        'Recibimos una solicitud para restablecer tu contraseña de EscuchaInterna.',
        'Haz clic en el siguiente enlace (válido por 1 hora):',
        '',
        notification.resetUrl,
        '',
        'Si tú no lo solicitaste, ignora este correo: tu contraseña actual sigue siendo válida.',
        '',
        'El equipo de EscuchaInterna',
      ].join('\n'),
      ownerUserId: notification.userId,
    });
  }
}
