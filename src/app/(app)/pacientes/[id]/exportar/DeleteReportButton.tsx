'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { deleteReportAction } from './actions';

export function DeleteReportButton({
  reportId,
  patientId,
  reportTitle,
}: {
  reportId: string;
  patientId: string;
  reportTitle: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteReportAction(reportId, patientId);
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo eliminar el reporte.');
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Eliminar borrador «${reportTitle}»`}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={13} /> Eliminar
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-soft">¿Eliminar este borrador?</span>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={confirmDelete}
        disabled={pending}
        className="px-2.5 disabled:opacity-50"
      >
        {pending ? 'Eliminando…' : 'Sí, eliminar'}
      </Button>
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
