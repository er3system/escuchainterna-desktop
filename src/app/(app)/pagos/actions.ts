'use server';

import { revalidatePath } from 'next/cache';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { GetInvoiceMessage } from '@/contexts/billing/application/get-invoice-message/GetInvoiceMessage';
import { MarkBookingPaid } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaid';
import { MarkBookingPaidMessage } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaidMessage';
import { MarkBookingUnpaid } from '@/contexts/billing/application/mark-booking-unpaid/MarkBookingUnpaid';
import { MarkBookingUnpaidMessage } from '@/contexts/billing/application/mark-booking-unpaid/MarkBookingUnpaidMessage';
import { SendInvoice } from '@/contexts/billing/application/send-invoice/SendInvoice';
import { SendInvoiceMessage } from '@/contexts/billing/application/send-invoice/SendInvoiceMessage';
import { SendPaymentReminder } from '@/contexts/billing/application/send-payment-reminder/SendPaymentReminder';
import { SendPaymentReminderMessage } from '@/contexts/billing/application/send-payment-reminder/SendPaymentReminderMessage';
import { ToggleAutoPaymentReminders } from '@/contexts/billing/application/toggle-auto-payment-reminders/ToggleAutoPaymentReminders';
import { UpdatePatientTags } from '@/contexts/billing/application/update-patient-tags/UpdatePatientTags';
import { UpdatePatientTagsMessage } from '@/contexts/billing/application/update-patient-tags/UpdatePatientTagsMessage';
import { UpdatePaymentReminderTemplate } from '@/contexts/billing/application/update-payment-reminder-template/UpdatePaymentReminderTemplate';
import { UpdatePaymentReminderTemplateMessage } from '@/contexts/billing/application/update-payment-reminder-template/UpdatePaymentReminderTemplateMessage';
import type { InvoiceMessageView } from '@/contexts/billing/domain/repositories/InvoiceRepository';
import { OutboxInvoiceEmailSender } from '@/contexts/billing/infrastructure/notifications/OutboxInvoiceEmailSender';
import { OutboxPaymentReminderSender } from '@/contexts/billing/infrastructure/notifications/OutboxPaymentReminderSender';
import { StubPaymentLinkProvider } from '@/contexts/billing/infrastructure/payments/StubPaymentLinkProvider';
import { SqliteBillingProfileRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBillingProfileRepository';
import { SqliteBookingPaymentRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBookingPaymentRepository';
import { SqliteInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/SqliteInvoiceRepository';
import { SqlitePatientTagsRepository } from '@/contexts/billing/infrastructure/persistence/SqlitePatientTagsRepository';
import { SqlitePaymentReminderTemplateRepository } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentReminderTemplateRepository';
import { SqlitePaymentsLedger } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger';
import type { CurrencyAmount } from '@/contexts/billing/domain/value-objects/currencyTotals';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { convertAmount, getExchangeRates } from '@/shared/infrastructure/exchange-rates/ExchangeRates';
import {
  requirePaymentConfigurationAccess,
  requirePaymentModuleOwnerUserId,
  requirePaymentWriteOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';

export interface BillingActionState {
  ok: boolean;
  error?: string;
}

async function run(
  action: (ownerUserId: string) => Promise<void>,
  authorize: () => Promise<string> = requirePaymentWriteOwnerUserId,
): Promise<BillingActionState> {
  const ownerUserId = await authorize();
  try {
    await action(ownerUserId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' };
  }
  revalidatePath('/pagos');
  revalidatePath('/inicio');
  return { ok: true };
}

export async function markBookingPaidAction(input: {
  bookingId: string;
  method: string;
  paidAt?: string;
}): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    const message = new MarkBookingPaidMessage(input);
    await new MarkBookingPaid(new SqliteBookingPaymentRepository(ownerUserId)).markPaid(message);
  });
}

export async function markBookingUnpaidAction(input: { bookingId: string }): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    const message = new MarkBookingUnpaidMessage(input);
    await new MarkBookingUnpaid(new SqliteBookingPaymentRepository(ownerUserId)).markUnpaid(message);
  });
}

export async function sendPaymentReminderAction(input: { bookingId: string }): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    const message = new SendPaymentReminderMessage(input);
    await new SendPaymentReminder(
      new SqlitePaymentsLedger(ownerUserId),
      new SqliteBillingProfileRepository(ownerUserId),
      new StubPaymentLinkProvider(),
      new OutboxPaymentReminderSender(ownerUserId),
      new SqlitePaymentReminderTemplateRepository(ownerUserId),
    ).send(message);
  });
}

export interface SendInvoiceActionState extends BillingActionState {
  folio?: string;
}

/** «Enviar recibo» de una sesión pagada (v2-spec §6.13; renombrado en v3 §7). */
export async function sendInvoiceAction(input: { bookingId: string }): Promise<SendInvoiceActionState> {
  const ownerUserId = await requirePaymentWriteOwnerUserId();
  try {
    const message = new SendInvoiceMessage(input);
    // Atómico: el registro en outbox, la factura y la etiqueta del paciente confirman
    // o revierten juntos (evita recibo "enviado" sin factura, o factura sin etiqueta).
    const result = await getDatabaseAdapter().transaction(() =>
      new SendInvoice(
        new SqlitePaymentsLedger(ownerUserId),
        new SqliteBillingProfileRepository(ownerUserId),
        new SqliteInvoiceRepository(ownerUserId),
        new OutboxInvoiceEmailSender(ownerUserId),
        new SqlitePatientTagsRepository(ownerUserId),
      ).send(message),
    );
    revalidatePath('/pagos');
    revalidatePath('/mensajes');
    return { ok: true, folio: result.folio };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo enviar el recibo.' };
  }
}

export interface InvoiceMessageActionState extends BillingActionState {
  message?: InvoiceMessageView;
}

/** Mensaje del outbox detrás de una etiqueta «Recibo DD/MM/AAAA» (v2-spec §6.13). */
export async function getInvoiceMessageAction(input: {
  patientId: string;
  tag: string;
}): Promise<InvoiceMessageActionState> {
  const ownerUserId = await requirePaymentModuleOwnerUserId();
  try {
    const message = await new GetInvoiceMessage(new SqliteInvoiceRepository(ownerUserId)).forPatientTag(input);
    if (!message) {
      return { ok: false, error: 'No encontramos un recibo enviado para esta etiqueta.' };
    }
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo cargar el recibo.' };
  }
}

/** Edita el contenido de la plantilla `recordatorio_pago` del profesional (el nombre no cambia). */
export async function updatePaymentReminderTemplateAction(input: {
  body: string;
}): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    const message = new UpdatePaymentReminderTemplateMessage(input);
    await new UpdatePaymentReminderTemplate(
      new SqlitePaymentReminderTemplateRepository(ownerUserId),
    ).update(message);
  }, requirePaymentConfigurationAccess);
}

export async function updatePatientTagsAction(input: {
  patientId: string;
  tags: string[];
}): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    const message = new UpdatePatientTagsMessage(input);
    await new UpdatePatientTags(new SqlitePatientTagsRepository(ownerUserId)).update(message);
  }, requirePaymentModuleOwnerUserId);
}

export async function setAutoPaymentRemindersAction(enabled: boolean): Promise<BillingActionState> {
  return run(async (ownerUserId) => {
    await new ToggleAutoPaymentReminders(new SqliteBillingProfileRepository(ownerUserId)).toggle(enabled);
  }, requirePaymentConfigurationAccess);
}

export interface ConvertedTotals {
  target: string;
  /** Suma convertida de lo cobrado (solo monedas con tasa). */
  collected: number;
  /** Suma convertida de lo por cobrar (solo monedas con tasa). */
  pending: number;
  /** Monedas sin tasa disponible: se muestran aparte sin convertir. */
  skipped: Array<{ currency: string; collected: number; pending: number }>;
  source: 'open.er-api.com' | 'tabla-local';
  fetchedAt: string;
}

export interface ConvertTotalsActionState extends BillingActionState {
  conversion?: ConvertedTotals;
}

/**
 * «Conversión aproximada» de las cards de /pagos: convierte los totales por
 * moneda del filtro actual a la moneda elegida con tasas del día. SOLO
 * informativo: nunca se usa para cobrar ni se persiste.
 */
export async function convertTotalsAction(input: {
  targetCurrency: string;
  collected: CurrencyAmount[];
  pending: CurrencyAmount[];
}): Promise<ConvertTotalsActionState> {
  await requirePaymentModuleOwnerUserId();
  const target = input.targetCurrency;
  if (!SUPPORTED_CURRENCIES.some((item) => item.code === target)) {
    return { ok: false, error: `Moneda no soportada: «${target}».` };
  }
  try {
    const rates = await getExchangeRates(target);
    let collected = 0;
    let pending = 0;
    const skipped = new Map<string, { collected: number; pending: number }>();

    const accumulate = (totals: CurrencyAmount[], bucket: 'collected' | 'pending') => {
      for (const { currency, amount } of totals) {
        const converted = convertAmount(amount, currency, target, rates);
        if (converted === null) {
          const entry = skipped.get(currency) ?? { collected: 0, pending: 0 };
          entry[bucket] += amount;
          skipped.set(currency, entry);
        } else if (bucket === 'collected') {
          collected += converted;
        } else {
          pending += converted;
        }
      }
    };
    accumulate(input.collected, 'collected');
    accumulate(input.pending, 'pending');

    return {
      ok: true,
      conversion: {
        target,
        collected,
        pending,
        skipped: [...skipped.entries()].map(([currency, amounts]) => ({ currency, ...amounts })),
        source: rates.source,
        fetchedAt: rates.fetchedAt,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo calcular la conversión.',
    };
  }
}
