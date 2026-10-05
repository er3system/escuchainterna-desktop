'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore } from 'lucide-react';
import { setSessionArchivedAction } from '../sesiones/actions';

/**
 * Archiva (recuperable) o restaura una sesión desde la Evolución. Archivar pide una
 * confirmación ligera (no es destructivo); restaurar es inmediato.
 */
export function SessionArchiveButton({
  noteId,
  patientId,
  archived,
}: {
  noteId: string;
  patientId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !archived &&
      !window.confirm('¿Archivar esta sesión? Se quita de la Evolución, pero podrás restaurarla cuando quieras.')
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setSessionArchivedAction(noteId, patientId, !archived);
      if (result.ok) router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-soft transition hover:bg-bg hover:text-ink disabled:opacity-50"
    >
      {archived ? (
        <>
          <ArchiveRestore size={13} /> {pending ? 'Restaurando…' : 'Restaurar'}
        </>
      ) : (
        <>
          <Archive size={13} /> {pending ? 'Archivando…' : 'Archivar'}
        </>
      )}
    </button>
  );
}
