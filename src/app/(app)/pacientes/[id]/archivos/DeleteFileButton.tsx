'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteFileAction } from './actions';

export function DeleteFileButton({
  patientId,
  fileId,
  filename,
}: {
  patientId: string;
  fileId: string;
  filename: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`¿Eliminar "${filename}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await deleteFileAction(patientId, fileId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-danger hover:border-danger hover:bg-danger-soft disabled:opacity-50"
    >
      <Trash2 size={13} /> {pending ? 'Eliminando…' : 'Eliminar'}
    </button>
  );
}
