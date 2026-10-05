import { GetPaymentReminderTemplate } from '@/contexts/billing/application/get-payment-reminder-template/GetPaymentReminderTemplate';
import { ListPayments } from '@/contexts/billing/application/list-payments/ListPayments';
import { ListPaymentsQuery } from '@/contexts/billing/application/list-payments/ListPaymentsQuery';
import { SqliteBillingProfileRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBillingProfileRepository';
import { SqlitePaymentReminderTemplateRepository } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentReminderTemplateRepository';
import { SqlitePaymentsLedger } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { PageHeader } from '@/components/ui';
import { AutoRemindersToggle } from './AutoRemindersToggle';
import { PaymentsFilters } from './PaymentsFilters';
import { PaymentsSummary } from './PaymentsSummary';
import { PaymentsTable } from './PaymentsTable';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ownerUserId = await requireDataOwnerUserId();
  const params = await searchParams;
  const query = ListPaymentsQuery.fromPrimitives({
    onlyCompleted: single(params.completadas),
    paymentStatus: single(params.estado),
    fromDate: single(params.desde),
    toDate: single(params.hasta),
    tags: single(params.tags),
    text: single(params.q),
  });

  const listPayments = new ListPayments(new SqlitePaymentsLedger(ownerUserId));
  const page = await listPayments.list(query);
  const knownTags = await listPayments.knownTags();
  const profile = await new SqliteBillingProfileRepository(ownerUserId).findCurrent();
  const currency = profile?.currency ?? 'MXN';
  const reminderTemplate = await new GetPaymentReminderTemplate(
    new SqlitePaymentReminderTemplateRepository(ownerUserId),
  ).get();

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle="Estado de cobro de tus sesiones"
        actions={
          <AutoRemindersToggle
            initialEnabled={profile?.autoPaymentReminders ?? true}
            templateName={reminderTemplate.name}
            templateBody={reminderTemplate.body}
          />
        }
      />

      <PaymentsSummary
        collected={page.collectedByCurrency}
        pending={page.pendingByCurrency}
        profileCurrency={currency}
      />

      <PaymentsFilters knownTags={knownTags} />

      <PaymentsTable entries={page.entries} knownTags={knownTags} nowIso={new Date().toISOString()} />
    </div>
  );
}
