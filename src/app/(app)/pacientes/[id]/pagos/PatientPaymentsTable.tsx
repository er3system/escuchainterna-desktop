'use client';

import { useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckSquare, Receipt, Undo2, X } from 'lucide-react';
import type { PaymentsLedgerEntry } from '@/contexts/billing/domain/repositories/PaymentsLedger';
import { groupAmountsByCurrency } from '@/contexts/billing/domain/value-objects/currencyTotals';
import { feeReasonLabelFor } from '@/contexts/billing/domain/value-objects/feeReasonLabels';
import {
  allPaymentMethods,
  paymentMethodLabelFor,
} from '@/contexts/billing/domain/value-objects/paymentMethodLabels';
import { formatMoney } from '@/shared/domain/currencies';
import { Badge, EmptyState } from '@/components/ui';
import { markSelectedPaidAction, markSelectedUnpaidAction } from './actions';

const STATUS_LABELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  agendada: { label: 'Agendada', tone: 'neutral' },
  confirmada: { label: 'Confirmada', tone: 'primary' },
  completada: { label: 'Completada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
  inasistencia: { label: 'Inasistencia', tone: 'warning' },
};

/** Monto en SU moneda con el código visible (las sesiones pueden mezclar monedas). */
function money(amount: number, currency: string): string {
  return `${formatMoney(amount, currency)} ${currency}`;
}

/** Total por moneda en una sola línea: «$ 1,500.00 MXN + $ 200.000 COP». */
function totalsLabel(entries: PaymentsLedgerEntry[]): string {
  return groupAmountsByCurrency(
    entries.map((entry) => ({ amount: entry.chargeAmount, currency: entry.currency })),
  )
    .map((total) => money(total.amount, total.currency))
    .join(' + ');
}

/**
 * Sesiones del paciente con selección múltiple (v2-spec §6.14): marcar varias
 * como pagadas con un mismo método (paquetes 4/10) o devolverlas a pendiente.
 */
export function PatientPaymentsTable({
  patientId,
  entries,
  nowIso,
}: {
  patientId: string;
  entries: PaymentsLedgerEntry[];
  /** Momento de referencia (del servidor) para marcar pagos vencidos sin desajuste de hidratación. */
  nowIso: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState(false);
  const [unpayOpen, setUnpayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = entries.length > 0 && entries.every((entry) => selected.has(entry.bookingId));
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selected.has(entry.bookingId)),
    [entries, selected],
  );

  const toggle = (bookingId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(entries.map((entry) => entry.bookingId)));
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Sin sesiones"
        description="Este paciente todavía no tiene sesiones registradas. Agenda una desde el calendario."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          <CheckSquare size={15} className="text-ink-soft" />
          {selected.size === 0
            ? 'Selecciona sesiones para acciones en lote'
            : `${selected.size} seleccionada${selected.size === 1 ? '' : 's'} · ${totalsLabel(selectedEntries)}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setPayOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-success px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success-soft disabled:opacity-40"
          >
            <Receipt size={13} /> Marcar seleccionadas como pagadas
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setUnpayOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-bg disabled:opacity-40"
          >
            <Undo2 size={13} /> Marcar como pendientes
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        {error ? (
          <div className="border-b border-line bg-danger-soft px-4 py-2 text-sm text-danger">{error}</div>
        ) : null}
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todas las sesiones"
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
              </th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Agenda</th>
              <th className="px-4 py-3">Sesión</th>
              <th className="px-4 py-3">Costo</th>
              <th className="px-4 py-3">Pago</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const date = new Date(entry.startAt);
              const status = STATUS_LABELS[entry.bookingStatus] ?? {
                label: entry.bookingStatus,
                tone: 'neutral' as const,
              };
              const paid = entry.paymentStatus === 'pagada';
              // Vencida: sesión ya pasada y aún sin pagar (no aplica a canceladas).
              const overdue = !paid && entry.bookingStatus !== 'cancelada' && entry.startAt < nowIso;
              const feeLabel = entry.feeCharged > 0 ? feeReasonLabelFor(entry.feeReason) : null;
              const checked = selected.has(entry.bookingId);
              return (
                <tr
                  key={entry.bookingId}
                  onClick={() => toggle(entry.bookingId)}
                  className={`cursor-pointer border-b border-line last:border-b-0 ${
                    checked ? 'bg-primary-light/40 dark:bg-primary/15' : 'hover:bg-bg/60'
                  }`}
                >
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(entry.bookingId)}
                      aria-label={`Seleccionar la sesión del ${format(date, 'd MMM yyyy', { locale: es })}`}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink">{format(date, 'EEE, d MMM yyyy', { locale: es })}</p>
                    <p className="text-xs text-ink-soft">{format(date, 'h:mm a', { locale: es })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 text-ink">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.agendaColor }}
                      />
                      {entry.agendaName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{money(entry.chargeAmount, entry.currency)}</p>
                    {feeLabel ? (
                      <span className="mt-1 inline-block">
                        <Badge tone="warning">{feeLabel}</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {paid ? (
                      <div>
                        <Badge tone="success">Pagada</Badge>
                        <p className="mt-1 text-xs text-ink-soft">
                          {paymentMethodLabelFor(entry.paymentMethod)}
                          {entry.paidAt
                            ? ` · ${format(new Date(entry.paidAt), 'd MMM yyyy', { locale: es })}`
                            : ''}
                        </p>
                      </div>
                    ) : overdue ? (
                      <Badge tone="danger">Vencida</Badge>
                    ) : (
                      <Badge tone="warning">Pendiente</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payOpen ? (
        <MarkSelectedPaidModal
          patientId={patientId}
          entries={selectedEntries}
          onClose={() => setPayOpen(false)}
          onDone={() => setSelected(new Set())}
          onError={setError}
        />
      ) : null}
      {unpayOpen ? (
        <ConfirmUnpaidModal
          patientId={patientId}
          entries={selectedEntries}
          onClose={() => setUnpayOpen(false)}
          onDone={() => setSelected(new Set())}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card bg-surface p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-ink-soft hover:bg-bg"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MarkSelectedPaidModal({
  patientId,
  entries,
  onClose,
  onDone,
  onError,
}: {
  patientId: string;
  entries: PaymentsLedgerEntry[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const [method, setMethod] = useState<string>('transferencia');
  const [paidDate, setPaidDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await markSelectedPaidAction({
        patientId,
        bookingIds: entries.map((entry) => entry.bookingId),
        method,
        paidAt: paidDate ? new Date(`${paidDate}T12:00:00`).toISOString() : undefined,
      });
      if (!result.ok) onError(result.error ?? 'No se pudo registrar el pago.');
      else {
        onError(null);
        onDone();
      }
      onClose();
    });
  };

  return (
    <ModalShell title="Marcar seleccionadas como pagadas" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-soft">
        {entries.length} sesión{entries.length === 1 ? '' : 'es'} por un total de{' '}
        <span className="font-medium text-ink">{totalsLabel(entries)}</span>. El método y la
        fecha se aplican a todas (ideal para paquetes de 4 o 10 sesiones).
      </p>
      <label className="mb-1 block text-sm font-semibold text-ink">Método de pago:</label>
      <select
        value={method}
        onChange={(event) => setMethod(event.target.value)}
        className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
      >
        {allPaymentMethods().map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label className="mb-1 block text-sm font-semibold text-ink">Fecha de pago:</label>
      <input
        type="date"
        value={paidDate}
        onChange={(event) => setPaidDate(event.target.value)}
        className="mb-6 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-bg"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          Registrar pago
        </button>
      </div>
    </ModalShell>
  );
}

/** Confirmación al quitar pagos (v2-spec §6.13 aplica también al lote). */
function ConfirmUnpaidModal({
  patientId,
  entries,
  onClose,
  onDone,
  onError,
}: {
  patientId: string;
  entries: PaymentsLedgerEntry[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const paidCount = entries.filter((entry) => entry.paymentStatus === 'pagada').length;

  const confirm = () => {
    startTransition(async () => {
      const result = await markSelectedUnpaidAction({
        patientId,
        bookingIds: entries.map((entry) => entry.bookingId),
      });
      if (!result.ok) onError(result.error ?? 'No se pudo quitar el pago.');
      else {
        onError(null);
        onDone();
      }
      onClose();
    });
  };

  return (
    <ModalShell title="¿Marcar como pendientes?" onClose={onClose}>
      <p className="mb-2 text-sm text-ink">
        {entries.length} sesión{entries.length === 1 ? '' : 'es'} seleccionada
        {entries.length === 1 ? '' : 's'} ({totalsLabel(entries)}) volverá
        {entries.length === 1 ? '' : 'n'} a aparecer como{' '}
        <span className="font-medium text-danger">pendientes de pago</span>.
      </p>
      <p className="mb-6 text-sm text-ink-soft">
        {paidCount > 0
          ? `Se borrarán el método y la fecha de pago de ${paidCount} sesión${paidCount === 1 ? '' : 'es'} pagada${paidCount === 1 ? '' : 's'}.`
          : 'Ninguna de las seleccionadas está pagada: no habrá cambios visibles.'}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-bg"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Marcar como pendientes
        </button>
      </div>
    </ModalShell>
  );
}
