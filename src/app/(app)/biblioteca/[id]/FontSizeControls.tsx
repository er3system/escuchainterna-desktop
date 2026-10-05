'use client';

import { useEffect, useState } from 'react';

const MIN_SIZE = 15;
const MAX_SIZE = 21;
const DEFAULT_SIZE = 17;
const STORAGE_KEY = 'escuchainterna:lector:tamano';

/**
 * Controles A− / A+ del lector: ajustan la variable CSS --lector-font-size
 * (que consume el wrapper .lector) y persisten la preferencia en localStorage.
 */
export function FontSizeControls() {
  const [size, setSize] = useState(DEFAULT_SIZE);

  // Carga la preferencia guardada (solo en cliente).
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= MIN_SIZE && stored <= MAX_SIZE) setSize(stored);
  }, []);

  // Aplica el tamaño al documento y lo limpia al salir del lector.
  useEffect(() => {
    document.documentElement.style.setProperty('--lector-font-size', `${size}px`);
    return () => {
      document.documentElement.style.removeProperty('--lector-font-size');
    };
  }, [size]);

  function adjust(delta: number) {
    setSize((current) => {
      const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, current + delta));
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div
      role="group"
      aria-label="Tamaño de letra del lector"
      className="flex items-center overflow-hidden rounded-lg border border-line bg-surface"
    >
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={size <= MIN_SIZE}
        aria-label="Reducir tamaño de letra"
        title="Reducir tamaño de letra"
        className="px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        A−
      </button>
      <span
        aria-live="polite"
        className="min-w-9 border-x border-line px-1.5 py-1.5 text-center text-xs tabular-nums text-ink-soft"
      >
        {size}
      </span>
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={size >= MAX_SIZE}
        aria-label="Aumentar tamaño de letra"
        title="Aumentar tamaño de letra"
        className="px-2.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        A+
      </button>
    </div>
  );
}
