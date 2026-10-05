'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BellRing, FileText, Receipt, Tags, Undo2, X } from 'lucide-react';
import type { InvoiceMessageView } from '@/contexts/billing/domain/repositories/InvoiceRepository';
import type { PaymentsLedgerEntry } from '@/contexts/billing/domain/repositories/PaymentsLedger';
import { feeReasonLabelFor } from '@/contexts/billing/domain/value-objects/feeReasonLabels';
import {
  allPaymentMethods,
  paymentMethodLabelFor,
} from '@/contexts/billing/domain/value-objects/paymentMethodLabels';
import {
  isInvoiceTag,
  SUGGESTED_PATIENT_TAGS,
} from '@/contexts/billing/domain/value-objects/suggestedPatientTags';
import { formatMoney } from '@/shared/domain/currencies';
import { Badge, EmptyState } from '@/components/ui';
import { MessageBodyView } from '@/components/MessageBodyView';
import {
  getInvoiceMessageAction,
  markBookingPaidAction,
  markBookingUnpaidAction,
  sendInvoiceAction,
  sendPaymentReminderAction,
  updatePatientTagsAction,
} from './actions';

const STATUS_LABELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  agendada: { label: 'Agendada', tone: 'neutral' },
  confirmada: { label: 'Confirmada', tone: 'primary' },
  completada: { label: 'Completada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
  inasistencia: { label: 'Inasistencia', tone: 'warning' },
};

/** Monto en SU moneda con el código visible (las ganancias pueden mezclar monedas). */
function money(amount: number, currency: string): string {
  return `${formatMoney(amount, currency)} ${currency}`;
}

export function PaymentsTable({
  entries,
  knownTags,
  nowIso,
}: {
  entries: PaymentsLedgerEntry[];
  knownTags: string[];
  /** Momento de referencia (del servidor) para marcar pagos vencidos sin desajuste de hidratación. */
  nowIso: string;
}) {
  const [payTarget, setPayTarget] = useState<PaymentsLedgerEntry | null>(null);
  const [unpayTarget, setUnpayTarget] = useState<PaymentsLedgerEntry | null>(null);
  const [tagsTarget, setTagsTarget] = useState<PaymentsLedgerEntry | null>(null);
  const [invoiceView, setInvoiceView] = useState<{ patientId: string; tag: string } | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [invoicedIds, setInvoicedIds] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sendReminder = (entry: PaymentsLedgerEntry) => {
    setError(null);
    startTransition(async () => {
      const result = await sendPaymentReminderAction({ bookingId: entry.bookingId });
      if (!result.ok) setError(result.error ?? 'No se pudo enviar el recordatorio.');
      else setRemindedIds((prev) => new Set(prev).add(entry.bookingId));
    });
  };

  const sendInvoice = (entry: PaymentsLedgerEntry) => {
    setError(null);
    startTransition(async () => {
      const result = await sendInvoiceAction({ bookingId: entry.bookingId });
      if (!result.ok) setError(result.error ?? 'No se pudo enviar el recibo.');
      else if (result.folio) {
        setInvoicedIds((prev) => new Map(prev).set(entry.bookingId, result.folio ?? ''));
      }
    });
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Sin resultados"
        description="No encontramos sesiones para tu búsqueda. Ajusta los filtros o registra sesiones desde la agenda."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      {error ? (
        <div className="border-b border-line bg-danger-soft px-4 py-2 text-sm text-danger">{error}</div>
      ) : null}
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <th className="px-4 py-3">Paciente</th>
            <th className="px-4 py-3">Costo</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Sesión</th>
            <th className="px-4 py-3">Pago</th>
            <th className="px-4 py-3">Etiquetas</th>
            <th className="px-4 py-3 text-right">Acciones</th>
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
            const sentFolio = invoicedIds.get(entry.bookingId) ?? null;
            return (
              <tr key={entry.bookingId} className="border-b border-line last:border-b-0 hover:bg-bg/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{entry.patientName}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.agendaColor }}
                    />
                    {entry.agendaName}
                  </p>
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
                  <p className="text-xs text-ink-soft">{format(date, 'h:mm a', { locale: es })}</p>
                  <p className="text-ink">{format(date, 'EEE, d MMM yyyy', { locale: es })}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={status.tone}>{status.label}</Badge>
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
                <td className="px-4 py-3">
                  <div className="flex max-w-44 flex-wrap gap-1">
                    {entry.patientTags.length === 0 ? (
                      <span className="text-xs text-ink-soft">—</span>
                    ) : (
                      entry.patientTags.map((tag) =>
                        isInvoiceTag(tag) ? (
                          <button
                            key={tag}
                            type="button"
                            title="Ver el recibo enviado"
                            onClick={() => setInvoiceView({ patientId: entry.patientId, tag })}
                            className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success underline-offset-2 hover:underline"
                          >
                            {tag}
                          </button>
                        ) : (
                          <span
                            key={tag}
                            className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {tag}
                          </span>
                        ),
                      )
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {paid ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => sendInvoice(entry)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
                        >
                          <FileText size={13} />
                          {sentFolio
                            ? `Recibo enviado (${sentFolio})`
                            : entry.invoiceFolio
                              ? 'Reenviar recibo'
                              : 'Enviar recibo'}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setUnpayTarget(entry)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-bg disabled:opacity-50"
                        >
                          <Undo2 size={13} /> Quitar pago
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setPayTarget(entry)}
                          className="inline-flex items-center gap-1 rounded-lg border border-success px-2.5 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success-soft disabled:opacity-50"
                        >
                          <Receipt size={13} /> Marcar como pagada
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => sendReminder(entry)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
                        >
                          <BellRing size={13} />
                          {remindedIds.has(entry.bookingId) ? 'Recordatorio enviado' : 'Enviar recordatorio'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setTagsTarget(entry)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-bg disabled:opacity-50"
                    >
                      <Tags size={13} /> Etiquetas
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {payTarget ? (
        <MarkPaidModal entry={payTarget} onClose={() => setPayTarget(null)} onError={setError} />
      ) : null}
      {unpayTarget ? (
        <ConfirmRemovePaymentModal
          entry={unpayTarget}
          onClose={() => setUnpayTarget(null)}
          onError={setError}
        />
      ) : null}
      {tagsTarget ? (
        <TagsModal
          entry={tagsTarget}
          knownTags={knownTags}
          onClose={() => setTagsTarget(null)}
          onError={setError}
        />
      ) : null}
      {invoiceView ? (
        <InvoiceMessageModal
          patientId={invoiceView.patientId}
          tag={invoiceView.tag}
          onClose={() => setInvoiceView(null)}
        />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide = false,
  size,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** 'xl' para superficies que necesitan espacio (p. ej. ver un recibo completo). */
  size?: 'xl';
}) {
  const widthClass = size === 'xl' ? 'max-w-3xl' : wide ? 'max-w-xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        // Crece hasta el 90% del alto de la ventana y deja que el contenido haga scroll:
        // así un recibo largo se ve cómodo sin desbordar la pantalla.
        className={`flex w-full ${widthClass} flex-col rounded-card bg-surface p-6 shadow-card`}
        style={{ maxHeight: '90vh' }}
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
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Confirmación al quitar un pago (v2-spec §6.13). */
function ConfirmRemovePaymentModal({
  entry,
  onClose,
  onError,
}: {
  entry: PaymentsLedgerEntry;
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await markBookingUnpaidAction({ bookingId: entry.bookingId });
      if (!result.ok) onError(result.error ?? 'No se pudo quitar el pago.');
      else onError(null);
      onClose();
    });
  };

  return (
    <ModalShell title="¿Quitar el pago?" onClose={onClose}>
      <p className="mb-2 text-sm text-ink">
        La sesión de <span className="font-medium">{entry.patientName}</span> del{' '}
        {format(new Date(entry.startAt), "d 'de' MMMM yyyy", { locale: es })} por{' '}
        <span className="font-medium">{money(entry.chargeAmount, entry.currency)}</span> volverá a
        aparecer como <span className="font-medium text-danger">pendiente de pago</span>.
      </p>
      <p className="mb-6 text-sm text-ink-soft">
        Se borrarán el método y la fecha de pago registrados. Esta acción no envía ningún mensaje al
        paciente.
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
          Quitar pago
        </button>
      </div>
    </ModalShell>
  );
}

/** Etiqueta «Recibo DD/MM/AAAA» clickeable: muestra el mensaje del outbox (v2-spec §6.13). */
function InvoiceMessageModal({
  patientId,
  tag,
  onClose,
}: {
  patientId: string;
  tag: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<InvoiceMessageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInvoiceMessageAction({ patientId, tag })
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (!result.ok || !result.message) setError(result.error ?? 'No se pudo cargar el recibo.');
        else setMessage(result.message);
      })
      .catch(() => {
        // Falla de red: sin esto el modal quedaría en "cargando" para siempre.
        if (cancelled) return;
        setLoading(false);
        setError('No se pudo cargar el recibo.');
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, tag]);

  return (
    <ModalShell title={tag} onClose={onClose} size="xl">
      {loading ? <p className="text-sm text-ink-soft">Cargando el recibo…</p> : null}
      {error ? <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div> : null}
      {message ? (
        <div>
          <div className="mb-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <p className="text-ink-soft">
              Folio: <span className="font-medium text-ink">{message.folio}</span>
            </p>
            <p className="text-ink-soft">
              Enviada:{' '}
              <span className="font-medium text-ink">
                {format(new Date(message.sentAt), "d 'de' MMMM yyyy, h:mm a", { locale: es })}
              </span>
            </p>
            <p className="text-ink-soft">
              Canal: <span className="font-medium text-ink">Correo electrónico</span>
            </p>
            <p className="truncate text-ink-soft">
              Para: <span className="font-medium text-ink">{message.recipient || '—'}</span>
            </p>
          </div>
          <p className="mb-2 text-sm font-semibold text-ink">{message.subject}</p>
          <MessageBodyView
            body={message.body}
            recipientLabel={message.recipient}
            height="60vh"
            themeSettingsHref="/mensajes?temas=1"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-bg"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

function MarkPaidModal({
  entry,
  onClose,
  onError,
}: {
  entry: PaymentsLedgerEntry;
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const [method, setMethod] = useState<string>('transferencia');
  const [paidDate, setPaidDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await markBookingPaidAction({
        bookingId: entry.bookingId,
        method,
        paidAt: paidDate ? new Date(`${paidDate}T12:00:00`).toISOString() : undefined,
      });
      if (!result.ok) onError(result.error ?? 'No se pudo registrar el pago.');
      else onError(null);
      onClose();
    });
  };

  return (
    <ModalShell title="Marcar como pagada" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-soft">
        Sesión de <span className="font-medium text-ink">{entry.patientName}</span> ·{' '}
        {money(entry.chargeAmount, entry.currency)}
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
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}

function TagsModal({
  entry,
  knownTags,
  onClose,
  onError,
}: {
  entry: PaymentsLedgerEntry;
  knownTags: string[];
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const [tags, setTags] = useState<string[]>(entry.patientTags);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const suggestions = useMemo(() => {
    const owned = new Set(tags.map((tag) => tag.toLocaleLowerCase('es-MX')));
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const tag of [...SUGGESTED_PATIENT_TAGS, ...knownTags]) {
      const key = tag.toLocaleLowerCase('es-MX');
      if (owned.has(key) || seen.has(key)) continue;
      seen.add(key);
      merged.push(tag);
    }
    return merged;
  }, [knownTags, tags]);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (tags.some((existing) => existing.toLocaleLowerCase('es-MX') === tag.toLocaleLowerCase('es-MX'))) {
      setDraft('');
      return;
    }
    setTags((prev) => [...prev, tag]);
    setDraft('');
  };

  const save = () => {
    startTransition(async () => {
      const result = await updatePatientTagsAction({ patientId: entry.patientId, tags });
      if (!result.ok) onError(result.error ?? 'No se pudieron guardar las etiquetas.');
      else onError(null);
      onClose();
    });
  };

  return (
    <ModalShell title={`Etiquetas de ${entry.patientName}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-ink-soft">El paciente no tiene etiquetas.</p>
        ) : (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                aria-label={`Quitar ${tag}`}
                onClick={() => setTags((prev) => prev.filter((existing) => existing !== tag))}
                className="rounded-full p-0.5 hover:bg-primary hover:text-white"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addTag(draft);
          }
        }}
        placeholder="Busca o agrega una etiqueta (Enter para añadir)"
        className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft"
      />
      {suggestions.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {suggestions
            .filter((tag) => !draft || tag.toLocaleLowerCase('es-MX').includes(draft.toLocaleLowerCase('es-MX')))
            .slice(0, 14)
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:bg-primary-light hover:text-primary"
              >
                + {tag}
              </button>
            ))}
        </div>
      ) : null}
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
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}
