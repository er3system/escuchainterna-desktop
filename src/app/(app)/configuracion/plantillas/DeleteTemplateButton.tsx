'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTemplateAction } from './actions';

export function DeleteTemplateButton({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`¿Eliminar la plantilla "${templateName}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const result = await deleteTemplateAction(templateId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-danger hover:border-danger hover:bg-danger-soft disabled:opacity-50"
      >
        <Trash2 size={13} /> {pending ? 'Eliminando…' : 'Eliminar'}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </>
  );
}
