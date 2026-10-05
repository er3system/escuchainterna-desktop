'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { deleteRecordAction } from './actions';

/**
 * Eliminación con confirmación fuerte (spec v2 §6.9): el profesional debe
 * escribir ELIMINAR para habilitar el borrado definitivo.
 */
export function DeleteRecordButton({
  recordId,
  patientId,
  recordTitle,
  redirectToList = false,
}: {
  recordId: string;
  patientId: string;
  recordTitle: string;
  redirectToList?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmed = confirmation.trim().toUpperCase() === 'ELIMINAR';

  function close() {
    setOpen(false);
    setConfirmation('');
    setError(null);
  }

  function confirmDelete() {
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteRecordAction(recordId, patientId);
      if (result.ok) {
        close();
        if (redirectToList) {
          router.push(`/pacientes/${patientId}/historia`);
        }
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo eliminar la historia.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Eliminar historia clínica"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={13} /> Eliminar
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de historia clínica"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle size={18} />
                </span>
                <h3 className="text-base font-bold text-ink">Eliminar historia clínica</h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cancelar"
                className="rounded p-1 text-ink-soft hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-ink-soft">
              Vas a eliminar <span className="font-semibold text-ink">«{recordTitle}»</span> de forma{' '}
              <span className="font-semibold text-danger">definitiva</span>, incluidas todas sus
              respuestas y las sugerencias de IA asociadas. Esta acción no se puede deshacer.
            </p>
            <label className="mt-4 block text-sm text-ink">
              Escribe <span className="font-mono font-bold">ELIMINAR</span> para confirmar:
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoFocus
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
              >
                Cancelar
              </button>
              <Button
                variant="danger"
                type="button"
                onClick={confirmDelete}
                disabled={!confirmed || pending}
                className="disabled:opacity-40"
              >
                {pending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
