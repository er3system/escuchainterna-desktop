'use client';

import { useTransition } from 'react';
import { setReceptionEnabledAction } from '../actions';

/** Switch para habilitar/deshabilitar la recepción multi-consultorio de la organización. */
export function ReceptionToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() => startTransition(() => setReceptionEnabledAction(!enabled))}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? 'bg-primary' : 'bg-line'
      }`}
      aria-label={enabled ? 'Deshabilitar recepción' : 'Habilitar recepción'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
