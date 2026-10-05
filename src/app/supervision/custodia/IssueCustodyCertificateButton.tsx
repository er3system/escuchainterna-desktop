'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2 } from 'lucide-react';
import { issueCustodyCertificateAction } from '../actions';

/**
 * Emite un certificado del docente sobre un paciente en custodia institucional (el
 * estudiante que lo atendía se retiró). Crea el borrador (propiedad del docente) y lleva
 * a su editor para redactarlo y firmarlo con su tarjeta.
 */
export function IssueCustodyCertificateButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await issueCustodyCertificateAction(patientId);
      if (result.ok && result.reportId) {
        router.push(`/supervision/custodia/${patientId}/certificados/${result.reportId}`);
      } else {
        setError(result.error ?? 'No se pudo emitir el certificado.');
      }
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={issue}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <FilePlus2 size={14} /> {pending ? 'Creando…' : 'Emitir certificado'}
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
