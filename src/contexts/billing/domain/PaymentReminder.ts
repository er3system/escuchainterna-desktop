import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoneyAmount } from './value-objects/MoneyAmount';
import { renderPaymentReminderTemplate } from './value-objects/paymentReminderTemplate';

export interface PaymentReminderPrimitives {
  bookingId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  subject: string;
  body: string;
}

/**
 * Recordatorio de pago de una sesión (ui-spec §4.4): monto, fecha de la sesión,
 * liga de pago simulada y políticas de pago del perfil del profesional.
 */
export class PaymentReminder {
  private constructor(
    private readonly bookingId: string,
    private readonly patientId: string,
    private readonly patientName: string,
    private readonly patientPhone: string,
    private readonly practitionerName: string,
    private readonly amount: MoneyAmount,
    private readonly currency: string,
    private readonly sessionStartAt: Date,
    private readonly paymentLink: string,
    private readonly paymentPolicies: string,
    private readonly customTemplate: string | null,
  ) {}

  public static forSession(input: {
    bookingId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    practitionerName: string;
    amount: number;
    currency: string;
    sessionStartAt: string;
    paymentLink: string;
    paymentPolicies: string;
    /** Plantilla personalizada del profesional (message_templates); null = integrada. */
    customTemplate?: string | null;
  }): PaymentReminder {
    return new PaymentReminder(
      input.bookingId,
      input.patientId,
      input.patientName,
      input.patientPhone,
      input.practitionerName.trim() || 'tu terapeuta',
      new MoneyAmount(input.amount),
      input.currency,
      new Date(input.sessionStartAt),
      input.paymentLink,
      input.paymentPolicies.trim(),
      input.customTemplate?.trim() || null,
    );
  }

  public subject(): string {
    return 'Recordatorio de pago';
  }

  public body(): string {
    const sessionDate = format(this.sessionStartAt, 'dd/MM/yyyy', { locale: es });
    const sessionHour = format(this.sessionStartAt, 'hh:mm a', { locale: es });
    if (this.customTemplate) {
      return renderPaymentReminderTemplate(this.customTemplate, {
        paciente: this.patientName,
        profesional: this.practitionerName,
        fecha: sessionDate,
        hora: sessionHour,
        monto: this.amount.formatted(this.currency),
        liga_pago: this.paymentLink,
        politicas: this.paymentPolicies,
      });
    }
    const lines = [
      '💳 Recordatorio de pago',
      `Hola ${this.patientName}, tienes un pago pendiente de tu sesión con *${this.practitionerName}*.`,
      '',
      '*Detalles del pago*',
      `🗓️ *Sesión:* ${sessionDate} ${sessionHour}`,
      `💵 *Monto:* ${this.amount.formatted(this.currency)}`,
      `🔗 *Liga de pago:* ${this.paymentLink}`,
    ];
    if (this.paymentPolicies) {
      lines.push('', this.paymentPolicies);
    }
    lines.push('', 'Mensaje automatizado: no responder a este mensaje.');
    return lines.join('\n');
  }

  public toPrimitives(): PaymentReminderPrimitives {
    return {
      bookingId: this.bookingId,
      patientId: this.patientId,
      patientName: this.patientName,
      patientPhone: this.patientPhone,
      subject: this.subject(),
      body: this.body(),
    };
  }
}
