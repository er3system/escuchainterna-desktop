'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { createExpedienteReportAction } from './actions';

/**
 * Genera la "Historia clínica completa": ensambla el expediente consolidado
 * (núcleo + bloques + Evolución + diagnósticos) en un reporte firmable y lleva
 * a su editor para revisar y firmar.
 */
export function ExpedienteReportButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await createExpedienteReportAction(patientId);
      if (result.ok) {
        router.push(`/pacientes/${patientId}/exportar/reportes/${result.reportId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        onClick={generate}
        disabled={pending}
        className="disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
        {pending ? 'Ensamblando expediente…' : 'Generar historia clínica completa'}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
