'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteAssessmentAction } from '../actions';

export function DeleteAssessmentButton({
  patientId,
  assessmentId,
}: {
  patientId: string;
  assessmentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm('¿Eliminar esta aplicación del historial? No se puede deshacer.')) return;
    startTransition(async () => {
      try {
        await deleteAssessmentAction(patientId, assessmentId);
        router.refresh();
      } catch {
        window.alert('No se pudo eliminar la aplicación.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label="Eliminar aplicación"
      className="rounded-lg border border-line p-1.5 text-ink-soft transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
    >
      <Trash2 size={15} />
    </button>
  );
}
