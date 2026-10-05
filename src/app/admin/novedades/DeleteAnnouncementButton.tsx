'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAnnouncementAction } from './actions';

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnouncementAction(id);
      if (result?.error) setError(result.error);
      // En éxito, revalidatePath refresca la lista y la tarjeta desaparece.
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Eliminar novedad"
        className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={15} />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-danger/90 disabled:opacity-50"
        >
          {pending ? 'Eliminando…' : 'Eliminar'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-ink-soft hover:text-ink"
        >
          Cancelar
        </button>
      </div>
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}
