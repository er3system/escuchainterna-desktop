import { randomUUID } from 'node:crypto';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '../../domain/Invoice';
import { InvoiceEmail } from '../../domain/InvoiceEmail';
import { InvoiceEmailSender } from '../../domain/InvoiceEmailSender';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { InvoiceForUnpaidBookingError } from '../../domain/errors/InvoiceForUnpaidBookingError';
import { BillingProfileRepository } from '../../domain/repositories/BillingProfileRepository';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';
import { PatientTagsRepository } from '../../domain/repositories/PatientTagsRepository';
import { PaymentsLedger } from '../../domain/repositories/PaymentsLedger';
import { InvoiceFolio } from '../../domain/value-objects/InvoiceFolio';
import { invoiceTagFor } from '../../domain/value-objects/suggestedPatientTags';
import { SendInvoiceMessage } from './SendInvoiceMessage';

export interface SendInvoiceResult {
  folio: string;
}

/**
 * «Mandar factura» de una sesión pagada (v2-spec §6.13): genera el folio
 * EI-<año>-<seq>, registra la factura, envía el correo (outbox, template
 * `factura`) y añade al paciente la etiqueta automática «Factura DD/MM/AAAA».
 */
export class SendInvoice {
  public constructor(
    private readonly ledger: PaymentsLedger,
    private readonly profiles: BillingProfileRepository,
    private readonly invoices: InvoiceRepository,
    private readonly sender: InvoiceEmailSender,
    private readonly patientTags: PatientTagsRepository,
  ) {}

  public async send(message: SendInvoiceMessage): Promise<SendInvoiceResult> {
    const entry = await this.ledger.findByBookingId(message.bookingId());
    if (!entry) throw new BookingNotFoundError(message.bookingId());
    if (entry.paymentStatus !== 'pagada') throw new InvoiceForUnpaidBookingError();

    const profile = await this.profiles.findCurrent();
    const sentAt = new Date();
    const folio = InvoiceFolio.generate(
      sentAt.getFullYear(),
      await this.invoices.nextSequenceForYear(sentAt.getFullYear()),
    );

    const email = InvoiceEmail.forPaidSession({
      bookingId: entry.bookingId,
      patientId: entry.patientId,
      patientName: entry.patientName,
      patientEmail: entry.patientEmail,
      folio: folio.valueOf(),
      amount: entry.chargeAmount,
      currency: entry.currency || profile?.currency || 'MXN',
      sessionStartAt: entry.startAt,
      agendaName: entry.agendaName,
      paymentMethod: entry.paymentMethod,
      paidAt: entry.paidAt,
      issuer: {
        fullName: profile?.fullName ?? '',
        professionalLicense: profile?.professionalLicense ?? '',
        contactAddress: profile?.contactAddress ?? '',
        contactPhone: profile?.contactPhone ?? '',
        email: profile?.email ?? '',
      },
    });
    // El sender escribe en el outbox vía el adaptador async (puerto DatabaseAdapter).
    const outboxMessageId = await this.sender.send(email);

    await this.invoices.save(
      Invoice.issue({
        id: randomUUID(),
        bookingId: entry.bookingId,
        patientId: entry.patientId,
        folio,
        amount: entry.chargeAmount,
        currency: entry.currency || profile?.currency || 'MXN',
        outboxMessageId,
        sentAt,
      }),
    );

    await this.tagPatient(entry.patientId, sentAt);
    return { folio: folio.valueOf() };
  }

  private async tagPatient(patientId: string, sentAt: Date): Promise<void> {
    const tag = invoiceTagFor(format(sentAt, 'dd/MM/yyyy', { locale: es }));
    const tags = await this.patientTags.findTags(patientId);
    if (tags === null) return;
    const exists = tags.some((existing) => existing.toLocaleLowerCase('es-MX') === tag.toLocaleLowerCase('es-MX'));
    if (exists) return;
    await this.patientTags.saveTags(patientId, [...tags, tag]);
  }
}
