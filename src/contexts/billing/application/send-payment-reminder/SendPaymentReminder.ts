import { PaymentReminder } from '../../domain/PaymentReminder';
import { PaymentLinkProvider } from '../../domain/PaymentLinkProvider';
import { PaymentReminderSender } from '../../domain/PaymentReminderSender';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { PaymentReminderForPaidBookingError } from '../../domain/errors/PaymentReminderForPaidBookingError';
import { BillingProfileRepository } from '../../domain/repositories/BillingProfileRepository';
import { PaymentReminderTemplateRepository } from '../../domain/repositories/PaymentReminderTemplateRepository';
import { PaymentsLedger } from '../../domain/repositories/PaymentsLedger';
import { SendPaymentReminderMessage } from './SendPaymentReminderMessage';

export class SendPaymentReminder {
  public constructor(
    private readonly ledger: PaymentsLedger,
    private readonly profiles: BillingProfileRepository,
    private readonly paymentLinks: PaymentLinkProvider,
    private readonly sender: PaymentReminderSender,
    /** Plantilla personalizada del profesional; opcional para no romper composiciones previas. */
    private readonly templates?: PaymentReminderTemplateRepository,
  ) {}

  public async send(message: SendPaymentReminderMessage): Promise<void> {
    const entry = await this.ledger.findByBookingId(message.bookingId());
    if (!entry) throw new BookingNotFoundError(message.bookingId());
    if (entry.paymentStatus === 'pagada') throw new PaymentReminderForPaidBookingError();

    const profile = await this.profiles.findCurrent();
    const ownTemplate = await this.templates?.findOwn();
    const reminder = PaymentReminder.forSession({
      bookingId: entry.bookingId,
      patientId: entry.patientId,
      patientName: entry.patientName,
      patientPhone: entry.patientPhone,
      practitionerName: profile?.fullName ?? '',
      amount: entry.chargeAmount,
      currency: entry.currency || profile?.currency || 'MXN',
      sessionStartAt: entry.startAt,
      paymentLink: this.paymentLinks.linkFor(entry.bookingId),
      paymentPolicies: profile?.paymentPolicies ?? '',
      customTemplate: ownTemplate?.body ?? null,
    });
    // El sender escribe en el outbox vía el adaptador async (puerto DatabaseAdapter).
    await this.sender.send(reminder);
  }
}
