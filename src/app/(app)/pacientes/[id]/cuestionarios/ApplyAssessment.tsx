'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ClipboardCheck, Download } from 'lucide-react';
import {
  ASSESSMENT_INSTRUMENTS,
  scoreAssessment,
  type SeverityTone,
} from '@/contexts/clinical-records/domain/assessmentInstruments';
import { Textarea } from '@/components/ui';
import { applyAssessmentAction } from '../actions';

const TONE_TEXT: Record<SeverityTone, string> = {
  success: 'text-success',
  caution: 'text-warning',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function ApplyAssessment({
  patientId,
  guidePdfInstrumentIds = [],
}: {
  patientId: string;
  /** Ids de instrumentos con guía/imprimible descargable en la biblioteca (coincide id↔publicación). */
  guidePdfInstrumentIds?: string[];
}) {
  const router = useRouter();
  const [instrumentId, setInstrumentId] = useState(ASSESSMENT_INSTRUMENTS[0].id);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const instrument = useMemo(
    () => ASSESSMENT_INSTRUMENTS.find((item) => item.id === instrumentId) ?? ASSESSMENT_INSTRUMENTS[0],
    [instrumentId],
  );
  const current = answers[instrument.id] ?? [];
  const answeredCount = current.filter((value) => typeof value === 'number').length;
  const complete = answeredCount === instrument.items.length;
  const score = useMemo(() => scoreAssessment(instrument, current), [instrument, current]);
  const hasGuide = guidePdfInstrumentIds.includes(instrument.id);

  function setAnswer(index: number, value: number) {
    setError(null);
    setAnswers((prev) => {
      const next = [...(prev[instrument.id] ?? [])];
      next[index] = value;
      return { ...prev, [instrument.id]: next };
    });
  }

  function submit() {
    if (!complete) {
      setError('Responde todos los ítems antes de guardar.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await applyAssessmentAction(
        patientId,
        instrument.id,
        current.map((value) => value ?? 0),
        notes,
      );
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar la aplicación.');
        return;
      }
      // Limpia solo este instrumento y el comentario; refresca el historial.
      setAnswers((prev) => ({ ...prev, [instrument.id]: [] }));
      setNotes('');
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <ClipboardCheck size={18} />
        </span>
        <div>
          <h2 className="text-base font-bold text-ink">Aplicar un cuestionario</h2>
          <p className="text-xs text-ink-soft">
            Se puntúa automáticamente y queda en el historial para ver la evolución.
          </p>
        </div>
      </div>

      {/* Selector de instrumento */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ASSESSMENT_INSTRUMENTS.map((item) => {
          const active = item.id === instrument.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setInstrumentId(item.id);
                setError(null);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-line text-ink-soft hover:border-primary hover:text-primary'
              }`}
            >
              {item.name} · {item.measures}
            </button>
          );
        })}
      </div>

      {hasGuide ? (
        <a
          href={`/api/biblioteca/${instrument.id}/pdf`}
          download
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
        >
          <Download size={13} /> Descargar guía e imprimible (PDF)
        </a>
      ) : null}

      <p className="mb-3 text-sm text-ink-soft">{instrument.instruction}</p>

      {/* Ítems */}
      <ol className="space-y-3">
        {instrument.items.map((item, index) => {
          const isRiskItem = instrument.riskItemIndex === index;
          return (
            <li
              key={index}
              className={`rounded-lg border p-3 ${
                isRiskItem ? 'border-danger/30 bg-danger-soft/30' : 'border-line'
              }`}
            >
              <p className="mb-2 text-sm text-ink">
                <span className="mr-1.5 font-mono text-xs text-ink-soft">{index + 1}.</span>
                {item}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {instrument.options.map((option) => {
                  const selected = current[index] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAnswer(index, option.value)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-line text-ink-soft hover:border-primary hover:text-primary'
                      }`}
                    >
                      {option.value} · {option.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Puntaje en vivo */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg px-4 py-3">
        <div>
          <p className="text-xs text-ink-soft">Puntaje</p>
          <p className="text-2xl font-bold text-ink">
            {score.total}
            <span className="text-base font-medium text-ink-soft"> / {instrument.maxScore}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-soft">
            {answeredCount} de {instrument.items.length} respondidos
          </p>
          {complete && score.severity ? (
            <p className={`text-lg font-bold ${TONE_TEXT[score.severity.tone]}`}>{score.severity.label}</p>
          ) : (
            <p className="text-lg font-medium text-ink-soft">—</p>
          )}
        </div>
      </div>

      {complete && score.riskFlag ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <span>
            <span className="font-semibold">Ítem de riesgo positivo.</span> Respondió afirmativamente
            al ítem de ideación/autolesión. Evalúa seguridad antes de continuar.
          </span>
        </div>
      ) : null}

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-ink">Comentario (opcional)</span>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Contexto de la aplicación, observaciones…"
        />
      </label>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !complete}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar aplicación'}
        </button>
      </div>
    </div>
  );
}
