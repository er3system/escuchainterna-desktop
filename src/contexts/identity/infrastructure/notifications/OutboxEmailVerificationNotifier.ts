import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import type {
  EmailVerificationNotification,
  EmailVerificationNotifier,
} from '../../domain/EmailVerificationNotifier';

/**
 * "Envía" el correo de verificación registrándolo en el outbox local
 * (template verificar_correo). En producción lo despacharía Resend cuando exista
 * RESEND_API_KEY; sin la clave queda solo en la bitácora in-app (comportamiento simulado).
 */
export class OutboxEmailVerificationNotifier implements EmailVerificationNotifier {
  public async sendVerificationLink(notification: EmailVerificationNotification): Promise<void> {
    const greetingName = notification.fullName.trim() || 'profesional';
    await writeOutboxMessage({
      channel: 'email',
      recipient: notification.email,
      recipientName: notification.fullName,
      template: 'verificar_correo',
      subject: 'Confirma tu correo · EscuchaInterna',
      body: [
        `Hola ${greetingName},`,
        '',
        'Gracias por crear tu cuenta en EscuchaInterna.',
        'Para confirmar que este correo es tuyo, haz clic en el siguiente enlace (válido por 7 días):',
        '',
        notification.verifyUrl,
        '',
        'Puedes seguir usando tu cuenta mientras tanto; confirmar tu correo nos ayuda a',
        'protegerla y a poder contactarte.',
        '',
        'Si tú no creaste esta cuenta, ignora este correo.',
        '',
        'El equipo de EscuchaInterna',
      ].join('\n'),
      ownerUserId: notification.userId,
    });
  }
}
