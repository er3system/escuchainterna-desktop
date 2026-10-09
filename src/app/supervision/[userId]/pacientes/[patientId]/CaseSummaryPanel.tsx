'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';
import { DocumentPrintActions } from '@/components/desktop/DocumentPrintActions';
import { Badge } from '@/components/ui';
import { generateCaseSummaryAction } from '../../../actions';

/**
 * Resumen del caso (IA) para el supervisor (v3.2): material de trabajo
 * académico que se genera bajo demanda, se puede regenerar e imprimir y NO
 * se guarda en el expediente del estudiante.
 */
export function CaseSummaryPanel({
  supervisedUserId,
  patientId,
  patientName,
  provider,
}: {
  supervisedUserId: string;
  patientId: string;
  patientName: string;
  provider: 'local' | 'anthropic';
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await generateCaseSummaryAction(supervisedUserId, patientId);
      if (result.ok) {
        setSummary(result.summary);
        setGeneratedAt(result.generatedAt);
      } else {
        setError(result.error);
      }
    });
  }

  if (summary === null) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          <Sparkles size={15} /> {pending ? 'Generando resumen…' : 'Resumen del caso (IA)'}
        </button>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #resumen-caso-imprimible, #resumen-caso-imprimible * { visibility: visible; }
          #resumen-caso-imprimible { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        }
      `}</style>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-primary dark:text-accent-2" />
          <h2 className="text-base font-bold text-ink">Resumen del caso (IA)</h2>
        </div>
        <Badge tone={provider === 'anthropic' ? 'primary' : 'neutral'}>
          {provider === 'anthropic' ? 'Claude' : 'IA local'}
        </Badge>
      </div>

      <div id="resumen-caso-imprimible">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{summary}</div>
        {generatedAt ? (
          <p className="mt-3 text-xs text-ink-soft">
            Resumen sobre {patientName}, generado el{' '}
            {format(new Date(generatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })} ·{' '}
            {provider === 'anthropic' ? 'Claude' : 'IA local'}
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DocumentPrintActions fileName={`Resumen-del-caso-${patientName}`} />
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-50"
        >
          <Sparkles size={14} /> {pending ? 'Generando…' : 'Regenerar'}
        </button>
        <p className="text-xs text-ink-soft">
          Material de supervisión: no se guarda en el expediente del estudiante.
        </p>
      </div>
    </div>
  );
}
