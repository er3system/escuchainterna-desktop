'use client';

import { useActionState, useEffect, useState } from 'react';
import { activateSubscriptionAction, type ActivateSubscriptionState } from './actions';

const INITIAL: ActivateSubscriptionState = {};

/** Botón de activación/cambio de plan del paywall (pago simulado en local). */
export function ActivatePlanButton({
  planId,
  label,
  highlighted = false,
  current = false,
}: {
  planId: string;
  label: string;
  highlighted?: boolean;
  current?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(activateSubscriptionAction, INITIAL);
  // Clave de idempotencia estable por montaje: un reintento (red caída / doble clic) del MISMO
  // botón reenvía la MISMA clave → el servidor no cobra dos veces. Se genera tras montar (en el
  // cliente) para no provocar desajuste de hidratación; cambiar de plan usa otro botón → otra clave.
  const [idempotencyKey, setIdempotencyKey] = useState('');
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  return (
    <div>
      <form action={dispatch}>
        <input type="hidden" name="plan" value={planId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <button
          type="submit"
          disabled={pending || current || !idempotencyKey}
          className={`w-full rounded-lg px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
            highlighted
              ? 'bg-primary text-white hover:bg-primary-dark'
              : 'border border-line text-ink hover:border-primary hover:text-primary'
          }`}
        >
          {current
            ? 'Tu plan actual'
            : !idempotencyKey
              ? 'Preparando…'
              : pending
                ? 'Activando…'
                : label}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-center text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
