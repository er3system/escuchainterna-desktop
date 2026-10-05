import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';
import { EmailDispatcher, MarketingEmail } from '../../domain/EmailDispatcher';

/**
 * Adaptador local del puerto EmailDispatcher: registra el correo en el outbox
 * compartido (la UI de /mensajes lo lee de ahí). No envía nada por la red.
 * El cuerpo se guarda envuelto en el tema de correo elegido por el profesional.
 */
export class OutboxEmailDispatcher implements EmailDispatcher {
  public constructor(private readonly ownerUserId: string) {}

  public async dispatch(email: MarketingEmail): Promise<void> {
    // writeOutboxMessage / wrapEmailBodyForOwner usan el adaptador async (puerto DatabaseAdapter).
    await writeOutboxMessage({
      channel: 'email',
      recipient: email.recipientEmail,
      recipientName: email.recipientName,
      template: email.template,
      subject: email.subject,
      body: await wrapEmailBodyForOwner(this.ownerUserId, email.body),
      patientId: email.patientId,
      ownerUserId: this.ownerUserId,
    });
  }
}
