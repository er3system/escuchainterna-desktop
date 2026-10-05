import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';
import { InvoiceEmail } from '../../domain/InvoiceEmail';
import { InvoiceEmailSender } from '../../domain/InvoiceEmailSender';

/**
 * Adaptador local del puerto de facturas: escribe el correo en el outbox
 * (canal email, plantilla `factura`) y devuelve el id del mensaje.
 * El cuerpo se guarda envuelto en el tema de correo elegido por el profesional.
 */
export class OutboxInvoiceEmailSender implements InvoiceEmailSender {
  public constructor(private readonly ownerUserId: string) {}

  public async send(email: InvoiceEmail): Promise<string> {
    const primitives = email.toPrimitives();
    return writeOutboxMessage({
      channel: 'email',
      recipient: primitives.patientEmail || primitives.patientName,
      recipientName: primitives.patientName,
      template: 'factura',
      subject: primitives.subject,
      body: await wrapEmailBodyForOwner(this.ownerUserId, primitives.body),
      bookingId: primitives.bookingId,
      patientId: primitives.patientId,
      ownerUserId: this.ownerUserId,
    });
  }
}
