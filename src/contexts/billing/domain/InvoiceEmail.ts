import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoneyAmount } from './value-objects/MoneyAmount';
import { paymentMethodLabelFor } from './value-objects/paymentMethodLabels';

export interface InvoiceEmailPrimitives {
  bookingId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  subject: string;
  body: string;
}

/**
 * Correo de factura de una sesión pagada (v2-spec §6.13): detalle de la sesión
 * + datos fiscales básicos del profesional (nombre, cédula, contacto).
 */
export class InvoiceEmail {
  private constructor(
    private readonly bookingId: string,
    private readonly patientId: string,
    private readonly patientName: string,
    private readonly patientEmail: string,
    private readonly folio: string,
    private readonly amount: MoneyAmount,
    private readonly currency: string,
    private readonly sessionStartAt: Date,
    private readonly agendaName: string,
    private readonly paymentMethod: string | null,
    private readonly paidAt: Date | null,
    private readonly issuer: {
      fullName: string;
      professionalLicense: string;
      contactAddress: string;
      contactPhone: string;
      email: string;
    },
  ) {}

  public static forPaidSession(input: {
    bookingId: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    folio: string;
    amount: number;
    currency: string;
    sessionStartAt: string;
    agendaName: string;
    paymentMethod: string | null;
    paidAt: string | null;
    issuer: {
      fullName: string;
      professionalLicense: string;
      contactAddress: string;
      contactPhone: string;
      email: string;
    };
  }): InvoiceEmail {
    return new InvoiceEmail(
      input.bookingId,
      input.patientId,
      input.patientName,
      input.patientEmail,
      input.folio,
      new MoneyAmount(input.amount),
      input.currency,
      new Date(input.sessionStartAt),
      input.agendaName,
      input.paymentMethod,
      input.paidAt ? new Date(input.paidAt) : null,
      input.issuer,
    );
  }

  public subject(): string {
    return `Recibo ${this.folio} — sesión del ${format(this.sessionStartAt, 'dd/MM/yyyy', { locale: es })}`;
  }

  public body(): string {
    const lines = [
      `Hola ${this.patientName},`,
      '',
      `Te compartimos el recibo de tu sesión con ${this.issuer.fullName.trim() || 'tu terapeuta'}.`,
      '',
      `Folio: ${this.folio}`,
      '',
      'Detalle de la sesión',
      `• Concepto: Sesión de psicoterapia — ${this.agendaName}`,
      `• Fecha de la sesión: ${format(this.sessionStartAt, "dd/MM/yyyy hh:mm aaaa", { locale: es })}`,
      `• Monto: ${this.amount.formatted(this.currency)}`,
      `• Método de pago: ${paymentMethodLabelFor(this.paymentMethod)}`,
    ];
    if (this.paidAt) {
      lines.push(`• Fecha de pago: ${format(this.paidAt, 'dd/MM/yyyy', { locale: es })}`);
    }
    lines.push('', 'Datos del emisor', `• ${this.issuer.fullName.trim() || 'Profesional de la salud mental'}`);
    if (this.issuer.professionalLicense.trim()) {
      lines.push(`• Cédula profesional: ${this.issuer.professionalLicense.trim()}`);
    }
    if (this.issuer.contactAddress.trim()) lines.push(`• Dirección: ${this.issuer.contactAddress.trim()}`);
    if (this.issuer.contactPhone.trim()) lines.push(`• Teléfono: ${this.issuer.contactPhone.trim()}`);
    if (this.issuer.email.trim()) lines.push(`• Correo: ${this.issuer.email.trim()}`);
    lines.push('', 'Gracias por tu confianza.', 'Mensaje automatizado enviado por EscuchaInterna.');
    return lines.join('\n');
  }

  public toPrimitives(): InvoiceEmailPrimitives {
    return {
      bookingId: this.bookingId,
      patientId: this.patientId,
      patientName: this.patientName,
      patientEmail: this.patientEmail,
      subject: this.subject(),
      body: this.body(),
    };
  }
}
