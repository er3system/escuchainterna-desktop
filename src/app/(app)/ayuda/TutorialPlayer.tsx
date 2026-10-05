'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, PartyPopper, RotateCcw, X } from 'lucide-react';
import { findTutorial, type Accent } from './tutorials';
import { markTutorialCompletedAction } from './actions';

const ACCENTS: Record<Accent, { panel: string; icon: string; dot: string }> = {
  primary: { panel: 'bg-primary-light', icon: 'text-primary', dot: 'bg-primary' },
  success: { panel: 'bg-success-soft', icon: 'text-success', dot: 'bg-success' },
  warning: { panel: 'bg-warning-soft', icon: 'text-warning', dot: 'bg-warning' },
};

export function TutorialPlayer({ tutorialId, desktopEdition = false }: { tutorialId: string; desktopEdition?: boolean }) {
  const tutorial = findTutorial(tutorialId, desktopEdition);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  const touchStartX = useRef<number | null>(null);

  const total = tutorial?.steps.length ?? 0;

  const finish = () => {
    setDone(true);
    startTransition(async () => {
      await markTutorialCompletedAction(tutorialId);
    });
  };

  const goNext = () => {
    if (step < total - 1) setStep(step + 1);
    else finish();
  };
  const goPrev = () => {
    if (step > 0) setStep(step - 1);
  };

  // Navegación con flechas del teclado (← →). Se re-registra al cambiar de paso.
  useEffect(() => {
    if (done) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goNext();
      else if (event.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done, total]);

  if (!tutorial) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-soft">
        Este tutorial no existe.{' '}
        <Link href="/ayuda" className="font-medium text-primary dark:text-accent-2 hover:underline">
          Volver a Ayuda
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
          <PartyPopper size={30} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">¡Completaste «{tutorial.title}»!</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Ya sabes cómo usar esta parte. Puedes repasarlo cuando quieras desde Ayuda.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/ayuda"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Check size={15} /> Volver a Ayuda
          </Link>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setDone(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            <RotateCcw size={15} /> Repasar
          </button>
        </div>
      </div>
    );
  }

  const current = tutorial.steps[step];
  const accent = ACCENTS[current.accent];
  const StepIcon = current.icon;
  const isLast = step === total - 1;

  return (
    <div className="mx-auto max-w-xl">
      {/* Cerrar + progreso */}
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/ayuda"
          aria-label="Salir del tutorial"
          className="rounded-lg p-1.5 text-ink-soft transition hover:bg-bg hover:text-ink"
        >
          <X size={18} />
        </Link>
        <div className="flex flex-1 items-center gap-1.5">
          {tutorial.steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= step ? accent.dot : 'bg-line'
              }`}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-medium text-ink-soft">
          {step + 1} / {total}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (delta < -45) goNext();
          else if (delta > 45) goPrev();
        }}
      >
        {/* "Ilustración" del paso */}
        <div className={`flex h-52 items-center justify-center ${accent.panel}`}>
          <StepIcon size={72} strokeWidth={1.5} className={accent.icon} />
        </div>
        {/* Texto del paso */}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Paso {step + 1} de {total}
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{current.body}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={15} /> Atrás
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          {isLast ? (
            <>
              <Check size={15} /> ¡Terminé!
            </>
          ) : (
            <>
              Siguiente <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-ink-soft">
        Desliza, usa las flechas ← → o los botones para avanzar.
      </p>
    </div>
  );
}
