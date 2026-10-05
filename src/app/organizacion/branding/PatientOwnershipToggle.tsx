'use client';

import { useState, useTransition } from 'react';
import { Building2 } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { setPatientOwnershipAction } from '../actions';

/**
 * Toggle de propiedad institucional de expedientes (cuentas institucionales §1).
 * Activado: los expedientes pertenecen a la organización (responsable del dato) y
 * los pacientes nuevos nacen bajo la org con asignación de tratante. No reescribe
 * pacientes existentes.
 */
export function PatientOwnershipToggle({ initialInstitutional }: { initialInstitutional: boolean }) {
  const [enabled, setEnabled] = useState(initialInstitutional);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const result = await setPatientOwnershipAction(next);
      if (result.error) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
            <Building2 size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Expedientes de la institución</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Los expedientes pertenecen a la organización; las personas tienen acceso mientras son
              miembros.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={toggle}
          label="Los expedientes pertenecen a la organización"
          disabled={pending}
        />
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-soft">
        <li>Los pacientes nuevos se crean bajo la organización, con su tratante y supervisor.</li>
        <li>La continuidad se mantiene reasignando el expediente vivo, nunca exportándolo a PDF.</li>
        <li>No cambia los pacientes ya existentes; solo aplica a los que se den de alta desde ahora.</li>
      </ul>
      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
      {pending ? <p className="mt-2 text-xs text-ink-soft">Guardando…</p> : null}
    </div>
  );
}
