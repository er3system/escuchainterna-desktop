'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteFamilyMapAction } from './actions';

export function DeleteMapButton({
  mapId,
  patientId,
  mapTitle,
}: {
  mapId: string;
  patientId: string;
  mapTitle: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteFamilyMapAction(mapId, patientId);
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo eliminar el mapa.');
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={13} /> Eliminar
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-soft">¿Eliminar «{mapTitle}»?</span>
      <button
        type="button"
        onClick={confirmDelete}
        disabled={pending}
        className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Eliminando…' : 'Sí, eliminar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
      >
        Cancelar
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
