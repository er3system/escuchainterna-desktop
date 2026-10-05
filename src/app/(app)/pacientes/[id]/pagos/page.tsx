import { Coins, Wallet } from 'lucide-react';
import { ListPayments } from '@/contexts/billing/application/list-payments/ListPayments';
import { ListPaymentsQuery } from '@/contexts/billing/application/list-payments/ListPaymentsQuery';
import { currencyLinesOrZero } from '@/contexts/billing/domain/value-objects/currencyTotals';
import { SqliteBillingProfileRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBillingProfileRepository';
import { SqlitePaymentsLedger } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger';
import { formatMoney } from '@/shared/domain/currencies';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { Card } from '@/components/ui';
import { PatientPaymentsTable } from './PatientPaymentsTable';

/**
 * Pestaña «Pagos» del expediente (v2-spec §6.14): todas las sesiones del
 * paciente con estado de pago, selección múltiple y totales (un renglón por
 * moneda cuando las sesiones mezclan monedas).
 */
export default async function PatientPagosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ownerUserId = await requireDataOwnerUserId();
  const { id } = await params;

  const query = ListPaymentsQuery.fromPrimitives({ onlyCompleted: '0', patientId: id });
  const page = await new ListPayments(new SqlitePaymentsLedger(ownerUserId)).list(query);
  const profile = await new SqliteBillingProfileRepository(ownerUserId).findCurrent();
  const currency = profile?.currency ?? 'MXN';

  const collectedLines = currencyLinesOrZero(page.collectedByCurrency, currency);
  const pendingLines = currencyLinesOrZero(page.pendingByCurrency, currency);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <Coins size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink-soft">Pagado por el paciente</p>
            {collectedLines.map((line) => (
              <p
                key={line.currency}
                className={collectedLines.length > 1 ? 'text-xl font-bold text-ink' : 'text-2xl font-bold text-ink'}
              >
                {formatMoney(line.amount, line.currency)}{' '}
                <span className="text-sm font-semibold text-ink-soft">{line.currency}</span>
              </p>
            ))}
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Wallet size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink-soft">Por cobrar</p>
            {pendingLines.map((line) => (
              <p
                key={line.currency}
                className={`font-bold text-warning ${pendingLines.length > 1 ? 'text-xl' : 'text-2xl'}`}
              >
                {formatMoney(line.amount, line.currency)}{' '}
                <span className="text-sm font-semibold text-warning/70">{line.currency}</span>
              </p>
            ))}
          </div>
        </Card>
      </div>

      <PatientPaymentsTable patientId={id} entries={page.entries} nowIso={new Date().toISOString()} />
    </div>
  );
}
