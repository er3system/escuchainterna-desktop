'use client';

import { useState, useTransition } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { cancelSubscriptionAction, resumeSubscriptionAction } from './actions';

/**
 * Cancelación self-service «al fin de periodo» + reanudar. Solo se monta para una suscripción
 * ACTIVA de cobro directo (la página la oculta para trial y cuentas cubiertas). Cancelar no
 * corta el acceso: lo conserva hasta `accessUntilLabel`; reanudar antes de esa fecha revierte.
 */
export function CancelSubscriptionControls({
  canceled,
  accessUntilLabel,
}: {
  canceled: boolean;
  accessUntilLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscriptionAction();
      if (result.error) setError(result.error);
      else setConfirming(false);
    });
  }

  function runResume() {
    setError(null);
    startTransition(async () => {
      const result = await resumeSubscriptionAction();
      if (result.error) setError(result.error);
    });
  }

  if (canceled) {
    return (
      <div className="mt-4 rounded-card border border-line bg-bg/60 p-4">
        <p className="text-sm font-semibold text-ink">Suscripción cancelada</p>
        <p className="mt-1 text-sm text-ink-soft">
          Conservas acceso hasta el <strong className="text-ink">{accessUntilLabel}</strong> y no se
          te hará ningún cobro nuevo. Puedes reanudarla antes de esa fecha para seguir sin
          interrupción.
        </p>
        <button
          type="button"
          onClick={runResume}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          <RotateCcw size={14} />
          {pending ? 'Reanudando…' : 'Reanudar suscripción'}
        </button>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-danger hover:underline"
      >
        <Ban size={13} />
        Cancelar suscripción
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-card border border-line bg-bg/60 p-4">
      <p className="text-sm font-semibold text-ink">¿Cancelar tu suscripción?</p>
      <p className="mt-1 text-sm text-ink-soft">
        Mantendrás acceso hasta el <strong className="text-ink">{accessUntilLabel}</strong> (el final
        del periodo que ya pagaste) y no se te hará ningún cobro nuevo. Puedes reanudarla cuando
        quieras antes de esa fecha.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={runCancel}
          disabled={pending}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Cancelando…' : 'Sí, cancelar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-primary"
        >
          No, mantenerla
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
