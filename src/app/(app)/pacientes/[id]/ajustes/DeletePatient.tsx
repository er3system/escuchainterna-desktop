'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deletePatientAction } from './actions';

export function DeletePatient({
  patientId,
  isInstitutional,
}: {
  patientId: string;
  isInstitutional: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function doDelete() {
    startTransition(async () => {
      const res = await deletePatientAction(patientId);
      if (res.ok) {
        router.push('/pacientes');
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo completar la acción.');
      }
    });
  }

  const explanation = isInstitutional
    ? 'Este paciente pertenece a tu organización. Se quitará de tu consulta y quedará bajo custodia de la institución; se avisará al responsable para que lo reasigne. No se borra nada.'
    : 'Se archivará el paciente. Podrás recuperarlo desde la lista de pacientes (filtro «Archivados»). No se borra nada.';
  const confirmLabel = isInstitutional ? 'Sí, quitar de mi consulta' : 'Sí, archivar paciente';

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
      >
        <Trash2 size={16} />
        Eliminar paciente
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4">
      <p className="flex items-start gap-2 text-sm text-ink">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        {explanation}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={doDelete}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
        >
          {pending ? 'Procesando…' : confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
