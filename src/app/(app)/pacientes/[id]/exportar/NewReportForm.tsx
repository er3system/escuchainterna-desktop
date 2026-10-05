'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, Sparkles } from 'lucide-react';
import {
  PATIENT_REPORT_KIND_DESCRIPTIONS,
  PATIENT_REPORT_KIND_LABELS,
  PATIENT_REPORT_KINDS,
  type PatientReportKind,
} from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { Button } from '@/components/ui';
import { createReportAction } from './actions';

/**
 * Generador de reportes firmables (spec v2 §7): tipo + país → la IA redacta
 * un borrador con los lineamientos normativos correspondientes.
 */
export function NewReportForm({
  patientId,
  countries,
  provider,
}: {
  patientId: string;
  countries: Array<{ code: string; name: string }>;
  provider: 'anthropic' | 'local';
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PatientReportKind>('informe_clinico');
  const [country, setCountry] = useState(countries[0]?.code ?? 'MX');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createReportAction(patientId, kind, country);
      if (result.ok) {
        router.push(`/pacientes/${patientId}/exportar/reportes/${result.reportId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PATIENT_REPORT_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded-lg border p-3 text-left transition ${
              kind === option
                ? 'border-primary bg-primary-light'
                : 'border-line bg-surface hover:border-primary'
            }`}
          >
            <p className={`text-sm font-semibold ${kind === option ? 'text-primary' : 'text-ink'}`}>
              {PATIENT_REPORT_KIND_LABELS[option]}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">{PATIENT_REPORT_KIND_DESCRIPTIONS[option]}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-56 flex-1 text-sm text-ink">
          <span className="font-semibold">Marco normativo del país:</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          onClick={create}
          disabled={pending}
          className="disabled:opacity-50"
        >
          {pending ? <Sparkles size={15} className="animate-pulse" /> : <FilePlus2 size={15} />}
          {pending ? 'Redactando borrador…' : 'Nuevo reporte'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        La IA redacta solo un borrador con los datos registrados del paciente
        {provider === 'local' ? ' (modo local: estructura básica)' : ''}; deberás revisarlo y firmarlo
        para imprimirlo sin marca de agua.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
