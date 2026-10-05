'use client';

import { useTransition } from 'react';
import { Repeat2 } from 'lucide-react';
import { changeHistoryModelAction } from './actions';

/**
 * "Cambiar de modelo" (§P3, no destructivo): degrada la historia actual a registro
 * aparte (conserva el contenido) y abre el selector de modelo. Confirma antes.
 */
export function ChangeModelButton({ recordId, patientId }: { recordId: string; patientId: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !window.confirm(
        'Esto convertirá la historia actual en un "registro aparte" —se conserva todo su contenido— y abrirá el selector para elegir otro modelo. ¿Continuar?',
      )
    ) {
      return;
    }
    startTransition(() => changeHistoryModelAction(recordId, patientId));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="Conserva el contenido como registro aparte y empieza con otro modelo"
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary disabled:opacity-50"
    >
      <Repeat2 size={13} /> {pending ? 'Cambiando…' : 'Cambiar de modelo'}
    </button>
  );
}
