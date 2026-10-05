'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ClipboardList, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { RecordSuggestionBatchPrimitives } from '@/contexts/clinical-records/domain/RecordSuggestionBatch';
import { applyRecordSuggestionsAction, suggestRecordUpdatesAction } from '../actions';

interface RecordOption {
  id: string;
  title: string;
  templateName: string;
}

type Decision = 'aprobada' | 'rechazada';

/**
 * Spec v2 §6.7: la IA propone cambios campo a campo a la historia clínica y
 * NADA se aplica sin la aprobación explícita del profesional.
 */
export function SuggestionsPanel({
  noteId,
  patientId,
  records,
  provider,
}: {
  noteId: string;
  patientId: string;
  records: RecordOption[];
  provider: 'anthropic' | 'local';
}) {
  const router = useRouter();
  const [recordId, setRecordId] = useState(records[0]?.id ?? '');
  const [batch, setBatch] = useState<RecordSuggestionBatchPrimitives | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ appliedCount: number; rejectedCount: number } | null>(null);
  const [generating, startGenerating] = useTransition();
  const [applying, startApplying] = useTransition();

  function generate() {
    if (!recordId) return;
    setError(null);
    setApplied(null);
    startGenerating(async () => {
      const result = await suggestRecordUpdatesAction(noteId, patientId, recordId);
      if (result.ok) {
        setBatch(result.batch);
        setDecisions({});
        if (result.batch.items.length === 0) {
          setError('La IA no encontró cambios que proponer para esta historia con el contenido actual de la nota.');
        }
      } else {
        setError(result.error);
      }
    });
  }

  function decide(fieldId: string, decision: Decision) {
    setDecisions((previous) => ({ ...previous, [fieldId]: decision }));
  }

  function applyApproved() {
    if (!batch) return;
    setError(null);
    startApplying(async () => {
      const result = await applyRecordSuggestionsAction(batch.id, patientId, decisions);
      if (result.ok) {
        setApplied({ appliedCount: result.appliedCount, rejectedCount: result.rejectedCount });
        setBatch(null);
        setDecisions({});
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const items = batch?.items ?? [];
  const decidedCount = items.filter((item) => decisions[item.fieldId]).length;
  const approvedCount = items.filter((item) => decisions[item.fieldId] === 'aprobada').length;

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-ink">Sugerir cambios a historia clínica</h3>
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        La IA propone cambios campo a campo a partir de esta nota. Nada se aplica sin tu aprobación.
        {provider === 'local'
          ? ' (Modo local: heurística sencilla. La IA remota requiere un proveedor configurado e internet.)'
          : ''}
      </p>

      {records.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Este paciente aún no tiene historias clínicas: crea una en la pestaña «Historia clínica» para
          poder sugerir cambios.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={recordId}
            onChange={(event) => setRecordId(event.target.value)}
            className="min-w-48 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            aria-label="Historia clínica destino"
          >
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.title} ({record.templateName})
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={generate}
            disabled={generating || !recordId}
            className="px-3 disabled:opacity-50"
          >
            <Sparkles size={14} /> {generating ? 'Analizando…' : 'Sugerir cambios'}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {applied ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
          <Check size={15} /> Se aplicaron {applied.appliedCount}{' '}
          {applied.appliedCount === 1 ? 'cambio aprobado' : 'cambios aprobados'}
          {applied.rejectedCount > 0 ? ` y se descartaron ${applied.rejectedCount}` : ''}.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const decision = decisions[item.fieldId];
            return (
              <div
                key={item.fieldId}
                className={`rounded-lg border p-3 ${
                  decision === 'aprobada'
                    ? 'border-success bg-success-soft/40'
                    : decision === 'rechazada'
                      ? 'border-line opacity-60'
                      : 'border-line'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <ClipboardList size={14} className="shrink-0 text-primary" /> {item.label}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => decide(item.fieldId, 'aprobada')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        decision === 'aprobada'
                          ? 'bg-success text-white'
                          : 'border border-line text-ink-soft hover:text-success'
                      }`}
                    >
                      <ThumbsUp size={12} /> Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(item.fieldId, 'rechazada')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        decision === 'rechazada'
                          ? 'bg-danger text-white'
                          : 'border border-line text-ink-soft hover:text-danger'
                      }`}
                    >
                      <ThumbsDown size={12} /> Rechazar
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg bg-bg p-2">
                    <p className="mb-0.5 font-semibold uppercase tracking-wide text-ink-soft">Valor actual</p>
                    <p className="whitespace-pre-wrap text-ink-soft">
                      {item.currentValue || <em>(vacío)</em>}
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary-light p-2">
                    <p className="mb-0.5 font-semibold uppercase tracking-wide text-primary">Sugerido</p>
                    <p className="whitespace-pre-wrap text-ink">{item.suggestedValue}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  <span className="font-semibold">Razón:</span> {item.reason}
                </p>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-xs text-ink-soft">
              {decidedCount}/{items.length} decididas · {approvedCount} por aplicar. Las no decididas se
              descartan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatch(null);
                  setDecisions({});
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
              >
                <X size={13} /> Descartar todo
              </button>
              <Button
                type="button"
                onClick={applyApproved}
                disabled={applying}
                size="sm"
                className="disabled:opacity-50"
              >
                <Check size={13} /> {applying ? 'Aplicando…' : `Aplicar aprobados (${approvedCount})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
