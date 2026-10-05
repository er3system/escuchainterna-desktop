'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { removeSupervisionLinkAction } from '../actions';

export function DeleteLinkButton({ linkId, description }: { linkId: string; description: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`¿Eliminar el vínculo de supervisión ${description}?`)) {
          startTransition(() => removeSupervisionLinkAction(linkId));
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-bg hover:text-danger disabled:opacity-60"
    >
      <Trash2 size={14} /> Eliminar
    </button>
  );
}
