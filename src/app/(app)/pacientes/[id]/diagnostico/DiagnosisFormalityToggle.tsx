'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, FlaskConical } from 'lucide-react';
import type { DiagnosisKind } from '@/contexts/clinical-records/domain/Diagnosis';
import { setDiagnosisFormalityAction } from './actions';

/**
 * Alterna la naturaleza del diagnóstico (hipótesis ⇄ formal). Confirmar uno FORMAL
 * exige tarjeta profesional: si el perfil no la tiene, el caso de uso lo rechaza y
 * mostramos el motivo aquí mismo (un practicante no puede afirmar un diagnóstico).
 */
export function DiagnosisFormalityToggle({
  diagnosisId,
  patientId,
  kind,
}: {
  diagnosisId: string;
  patientId: string;
  kind: DiagnosisKind;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target: DiagnosisKind = kind === 'formal' ? 'hipotesis' : 'formal';

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setDiagnosisFormalityAction(diagnosisId, patientId, target);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'No se pudo cambiar la naturaleza del diagnóstico.');
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {kind === 'formal' ? (
          <>
            <FlaskConical size={13} /> Marcar como hipótesis
          </>
        ) : (
          <>
            <BadgeCheck size={13} /> Confirmar como formal
          </>
        )}
      </button>
      {error ? <p className="max-w-xs text-right text-xs text-danger">{error}</p> : null}
    </div>
  );
}
