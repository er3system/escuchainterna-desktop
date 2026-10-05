import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import type { OutboxTemplate } from '@/shared/infrastructure/outbox/OutboxWriter';
import { writeWhatsappOrOmit } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { patientReminderChannels } from '@/shared/infrastructure/outbox/reminderPreferences';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import type { BookingNotifier, SessionNotificationData } from '../../domain/BookingNotifier';

/** Liga de pago: página pública de la sesión (/sesion/<id>), base APP_BASE_URL. */
function paymentLinkFor(bookingId: string): string {
  return `${getAppBaseUrl()}/sesion/${bookingId}`;
}

const AUTOMATED_FOOTER = 'Mensaje automatizado: no responder a este mensaje.';

/**
 * Notificador de sesiones sobre el outbox local: cada evento registra dos
 * mensajes (WhatsApp + correo) con plantillas en español estilo WhatsApp.
 */
export class OutboxBookingNotifier implements BookingNotifier {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async sessionBooked(data: SessionNotificationData): Promise<void> {
    const body = [
      '✅ Sesión agendada',
      `Ha agendado una sesión con *${data.practitionerName || 'su profesional'}*.`,
      '',
      '*Detalles de la sesión*',
      ...OutboxBookingNotifier.sessionDetailLines(data),
      '',
      AUTOMATED_FOOTER,
    ].join('\n');
    await this.dispatch('sesion_agendada', 'Sesión agendada', body, data);
  }

  public async sessionRescheduled(data: SessionNotificationData): Promise<void> {
    const body = [
      '🔄 Sesión reagendada',
      `Su sesión con *${data.practitionerName || 'su profesional'}* ha cambiado de fecha y hora.`,
      '',
      '*Nuevos detalles de la sesión*',
      ...OutboxBookingNotifier.sessionDetailLines(data),
      '',
      AUTOMATED_FOOTER,
    ].join('\n');
    await this.dispatch('sesion_reagendada', 'Sesión reagendada', body, data);
  }

  public async sessionCancelled(data: SessionNotificationData): Promise<void> {
    const startAt = new Date(data.startAt);
    const body = [
      '❌ Sesión cancelada',
      `Su sesión con *${data.practitionerName || 'su profesional'}* ha sido cancelada.`,
      '',
      '*Detalles de la sesión cancelada*',
      `📅 *Fecha:* ${OutboxBookingNotifier.formatDate(startAt)}`,
      `⏰ *Hora:* ${OutboxBookingNotifier.formatHour(startAt)}`,
      '',
      AUTOMATED_FOOTER,
    ].join('\n');
    await this.dispatch('sesion_cancelada', 'Sesión cancelada', body, data);
  }

  public async sessionReminder(data: SessionNotificationData): Promise<void> {
    const body = [
      '⏰ Recordatorio de sesión',
      `Hola ${data.patient.fullName}, te recordamos tu sesión con *${data.practitionerName || 'tu profesional'}*.`,
      '',
      '*Detalles de la sesión*',
      ...OutboxBookingNotifier.sessionDetailLines(data),
      '',
      AUTOMATED_FOOTER,
    ].join('\n');
    await this.dispatch('recordatorio_sesion', 'Recordatorio de sesión', body, data);
  }

  private async dispatch(
    template: OutboxTemplate,
    subject: string,
    body: string,
    data: SessionNotificationData,
  ): Promise<void> {
    // Resolución de plantilla: primero la personalizada del profesional
    // (message_templates con su owner), después la integrada (el cuerpo recibido).
    const custom = await this.findCustomTemplate(template);
    let effectiveSubject = subject;
    let effectiveBody = body;
    if (custom) {
      const variables = OutboxBookingNotifier.templateVariables(data);
      effectiveBody = OutboxBookingNotifier.renderTokens(custom.body, variables);
      if (custom.subject.trim()) {
        effectiveSubject = OutboxBookingNotifier.renderTokens(custom.subject, variables);
      }
    }
    // Preferencia del paciente por canal (Ajustes): SOLO afecta a los recordatorios,
    // no a confirmaciones/cancelaciones (esas el paciente siempre debe recibirlas).
    const channels =
      template === 'recordatorio_sesion'
        ? await patientReminderChannels(this.ownerUserId, data.patient.id)
        : { whatsapp: true, email: true };

    // Decisión de canal: el WhatsApp respeta el presupuesto del plan; si el
    // límite del mes se alcanzó queda un registro 'omitido' y el correo (abajo)
    // sale igual.
    if (channels.whatsapp) {
      await writeWhatsappOrOmit({
        recipient: data.patient.phone || data.patient.email,
        recipientName: data.patient.fullName,
        template,
        subject: effectiveSubject,
        body: effectiveBody,
        bookingId: data.bookingId,
        patientId: data.patient.id,
        ownerUserId: this.ownerUserId,
      });
    }
    if (channels.email) {
      await writeOutboxMessage({
        channel: 'email',
        recipient: data.patient.email || data.patient.phone,
        recipientName: data.patient.fullName,
        template,
        subject: effectiveSubject,
        // El correo se guarda envuelto en el tema visual elegido por el profesional.
        body: await wrapEmailBodyForOwner(this.ownerUserId, effectiveBody),
        bookingId: data.bookingId,
        patientId: data.patient.id,
        ownerUserId: this.ownerUserId,
      });
    }
  }

  /** Plantilla personalizada del owner para esa clave; null si usa la integrada. */
  private async findCustomTemplate(
    templateKey: string,
  ): Promise<{ subject: string; body: string } | null> {
    try {
      const row = await this.db.queryRow<{ subject: string; body: string }>(
        `SELECT subject, body FROM message_templates
            WHERE owner_user_id = ? AND template_key = ? LIMIT 1`,
        [this.ownerUserId, templateKey],
      );
      return row ? { subject: row.subject, body: row.body } : null;
    } catch {
      // Una notificación nunca debe romper la operación que la origina.
      return null;
    }
  }

  /** Variables {{token}} disponibles en las plantillas de sesión. */
  private static templateVariables(data: SessionNotificationData): Record<string, string> {
    const startAt = new Date(data.startAt);
    return {
      nombre: data.patient.fullName,
      profesional: data.practitionerName || 'tu profesional',
      fecha: OutboxBookingNotifier.formatDate(startAt),
      hora: OutboxBookingNotifier.formatHour(startAt),
      duracion: OutboxBookingNotifier.formatDuration(data.durationMinutes),
      modalidad: data.modality === 'virtual' ? 'En línea' : 'Presencial',
      ubicacion: data.modality === 'virtual' ? (data.meetUrl ?? '') : (data.address ?? ''),
      liga_sesion: data.meetUrl ?? '',
      monto: data.showPrice ? OutboxBookingNotifier.formatPrice(data.price, data.currency) : '',
      liga_pago: data.showPaymentLink ? paymentLinkFor(data.bookingId) : '',
      politicas: data.paymentPolicies.trim(),
    };
  }

  private static renderTokens(content: string, variables: Record<string, string>): string {
    let rendered = content;
    for (const [token, value] of Object.entries(variables)) {
      rendered = rendered.split(`{{${token}}}`).join(value);
    }
    return rendered.replace(/\n{3,}/g, '\n\n').trim();
  }

  private static sessionDetailLines(data: SessionNotificationData): string[] {
    const startAt = new Date(data.startAt);
    const lines = [
      `📅 *Fecha:* ${OutboxBookingNotifier.formatDate(startAt)}`,
      `⏰ *Hora:* ${OutboxBookingNotifier.formatHour(startAt)}`,
      `⏳ *Duración:* ${OutboxBookingNotifier.formatDuration(data.durationMinutes)}`,
    ];
    if (data.modality === 'virtual') {
      lines.push('🎥 *Modalidad:* En línea');
      if (data.meetUrl) {
        lines.push(`🔗 *Liga de la sesión:* ${data.meetUrl}`);
      }
    } else {
      lines.push('📍 *Modalidad:* Presencial');
      if (data.address) {
        lines.push(`📍 *Ubicación:* ${data.address}`);
      }
      if (data.mapsUrl) {
        lines.push(data.mapsUrl);
      }
    }
    if (data.showPrice) {
      lines.push(`💵 *Precio:* ${OutboxBookingNotifier.formatPrice(data.price, data.currency)}`);
    }
    if (data.showPaymentLink) {
      lines.push(`🔗 *Liga de pago:* ${paymentLinkFor(data.bookingId)}`);
    }
    if (data.paymentPolicies.trim()) {
      lines.push('', data.paymentPolicies.trim());
    }
    return lines;
  }

  private static formatDate(date: Date): string {
    return format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  }

  private static formatHour(date: Date): string {
    return format(date, 'h:mm aaaa', { locale: es });
  }

  private static formatDuration(durationMinutes: number): string {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }

  private static formatPrice(price: number, currency: string): string {
    return formatMoneyWithCode(price, currency);
  }
}
