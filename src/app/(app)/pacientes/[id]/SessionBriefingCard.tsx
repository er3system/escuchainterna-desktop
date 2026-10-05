'use client';

import { Fragment, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Info } from 'lucide-react';
import { Card } from '@/components/ui';
import { generarBriefing, type BriefingResult } from '@/app/(app)/asistente/actions';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; body: string; sources: string[]; gaps: string[] }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

/** Resalta las **negritas** del markdown sencillo dentro de una línea. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Renderiza el cuerpo (markdown sencillo) agrupando las viñetas consecutivas en
 * su propio <ul> y el resto como <p> sueltos: un <p> no puede ser hijo de <ul>
 * (HTML inválido). Las clases por línea son las mismas de siempre.
 */
function renderBody(body: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  let bullets: React.ReactNode[] = [];
  let bulletsStart = 0; // índice de línea donde arranca el grupo (key estable)
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${bulletsStart}`} className="space-y-1.5">
        {bullets}
      </ul>,
    );
    bullets = [];
  };
  body.split('\n').forEach((line, index) => {
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (bullets.length === 0) bulletsStart = index;
      bullets.push(
        <li
          key={index}
          className="ml-1 list-disc pl-1 text-sm leading-relaxed text-ink-soft marker:text-primary dark:marker:text-accent-2"
        >
          {renderInline(bullet[1])}
        </li>,
      );
      return;
    }
    flushBullets();
    if (line.trim() === '') return;
    blocks.push(
      <p key={index} className="text-sm leading-relaxed text-ink-soft">
        {renderInline(line)}
      </p>,
    );
  });
  flushBullets();
  return blocks;
}

/**
 * Briefing pre-sesión "Antes de ver a X": el psicólogo pide una síntesis de 60 s del caso antes de la
 * consulta. Reusa el asistente (consent-gated, medido, con citas/huecos). Solo-preguntar: la IA
 * organiza lo registrado y sugiere; el profesional lee y decide. No diagnostica ni escribe nada.
 */
export function SessionBriefingCard({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function run() {
    setState({ kind: 'loading' });
    let res: BriefingResult;
    try {
      res = await generarBriefing(patientId);
    } catch {
      setState({ kind: 'error', message: 'No pudimos generar el briefing. Inténtalo de nuevo.' });
      return;
    }
    if (!res.ok) setState({ kind: 'error', message: res.error });
    else if (!res.available) setState({ kind: 'unavailable' });
    else setState({ kind: 'done', body: res.body, sources: res.sources, gaps: res.gaps });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary dark:bg-primary/15 dark:text-accent-2">
            <Sparkles size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Briefing pre-sesión</h3>
            <p className="text-xs text-ink-soft">Síntesis de 60 s antes de la consulta</p>
          </div>
        </div>
        {state.kind === 'done' || state.kind === 'unavailable' || state.kind === 'error' ? (
          <button
            type="button"
            onClick={run}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
          >
            <RefreshCw size={13} /> Regenerar
          </button>
        ) : null}
      </div>

      {state.kind === 'idle' ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark"
          >
            <Sparkles size={15} /> Generar briefing
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            La IA organiza lo registrado en el expediente y sugiere líneas de exploración —{' '}
            <span className="font-medium">tú decides</span>. No diagnostica ni escribe nada.
          </p>
        </div>
      ) : null}

      {state.kind === 'loading' ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 size={15} className="animate-spin text-primary dark:text-accent-2" /> Preparando el briefing…
        </p>
      ) : null}

      {state.kind === 'unavailable' ? (
        <p className="mt-3 rounded-lg border border-line bg-bg px-3 py-2.5 text-xs leading-relaxed text-ink-soft dark:bg-white/5">
          No hay briefing disponible: este paciente no autorizó el procesamiento por IA (o aún no hay
          contexto suficiente). Puedes habilitarlo en su consentimiento informado.
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-3 text-sm text-danger">{state.message}</p>
      ) : null}

      {state.kind === 'done' ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">{renderBody(state.body)}</div>

          {state.sources.length > 0 ? (
            <div className="rounded-lg border border-line bg-bg px-3 py-2 dark:bg-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Fuentes</p>
              <ol className="mt-1 space-y-0.5">
                {state.sources.map((s, i) => (
                  <li key={i} className="text-xs text-ink-soft">
                    <span className="font-semibold text-primary dark:text-accent-2">[{i + 1}]</span> {s}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {state.gaps.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <Info size={13} className="mt-0.5 shrink-0 text-warning" />
              <span>
                <span className="font-medium">Lo que no consta:</span> {state.gaps.join(' · ')}
              </span>
            </p>
          ) : null}

          <p className="text-[11px] text-ink-soft">
            Sugerencias de IA a partir de tu expediente — no sustituyen tu juicio clínico.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
