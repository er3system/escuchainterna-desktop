import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import { patientReminderChannels } from '@/shared/infrastructure/outbox/reminderPreferences';
import { writeWhatsappOrOmit } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';
import { PaymentReminder } from '../../domain/PaymentReminder';
import { PaymentReminderSender } from '../../domain/PaymentReminderSender';

/**
 * Adaptador local del puerto de recordatorios de pago: escribe en el outbox
 * (canal WhatsApp, plantilla recordatorio_pago). La vista de mensajes lee de ahí.
 *
 * Decisión de canal (v3-spec §5): si el plan del dueño ya agotó sus WhatsApp
 * del mes, el WhatsApp queda como registro 'omitido' y el recordatorio sale
 * por correo — todo sigue funcionando, solo cambia el canal.
 */
export class OutboxPaymentReminderSender implements PaymentReminderSender {
  public constructor(private readonly ownerUserId: string) {}

  public async send(reminder: PaymentReminder): Promise<void> {
    const primitives = reminder.toPrimitives();
    // Preferencia del paciente por canal (Ajustes): si desactivó un canal, no se usa.
    const channels = await patientReminderChannels(this.ownerUserId, primitives.patientId);

    if (channels.whatsapp) {
      const whatsapp = await writeWhatsappOrOmit({
        recipient: primitives.patientPhone || primitives.patientName,
        recipientName: primitives.patientName,
        template: 'recordatorio_pago',
        subject: primitives.subject,
        body: primitives.body,
        bookingId: primitives.bookingId,
        patientId: primitives.patientId,
        ownerUserId: this.ownerUserId,
      });
      if (whatsapp.sent) return;
    }
    if (!channels.email) return;

    // WhatsApp desactivado o el plan agotó su cupo: el recordatorio llega por correo.
    await writeOutboxMessage({
      channel: 'email',
      recipient: (await this.findPatientEmail(primitives.patientId)) || primitives.patientName,
      recipientName: primitives.patientName,
      template: 'recordatorio_pago',
      subject: primitives.subject,
      body: await wrapEmailBodyForOwner(this.ownerUserId, primitives.body),
      bookingId: primitives.bookingId,
      patientId: primitives.patientId,
      ownerUserId: this.ownerUserId,
    });
  }

  /** El dominio del recordatorio solo conoce el teléfono; el correo se resuelve aquí. */
  private async findPatientEmail(patientId: string): Promise<string> {
    try {
      const row = await getDatabaseAdapter().queryRow<{ email: string }>(
        'SELECT email FROM patients WHERE id = ? AND owner_user_id = ?',
        [patientId, this.ownerUserId],
      );
      return row?.email?.trim() ?? '';
    } catch {
      return '';
    }
  }
}
