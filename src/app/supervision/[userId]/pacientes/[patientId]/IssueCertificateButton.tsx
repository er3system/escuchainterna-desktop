'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2 } from 'lucide-react';
import { issueSupervisorCertificateAction } from '../../../actions';

/**
 * El docente emite su propio certificado del paciente del supervisado. Crea el borrador
 * (propiedad del docente) y lleva a su editor para redactarlo y firmarlo con su tarjeta.
 */
export function IssueCertificateButton({
  supervisedUserId,
  patientId,
}: {
  supervisedUserId: string;
  patientId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await issueSupervisorCertificateAction(supervisedUserId, patientId);
      if (result.ok && result.reportId) {
        router.push(
          `/supervision/${supervisedUserId}/pacientes/${patientId}/certificados/${result.reportId}`,
        );
      } else {
        setError(result.error ?? 'No se pudo emitir el certificado.');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={issue}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <FilePlus2 size={15} /> {pending ? 'Creando…' : 'Emitir certificado'}
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
