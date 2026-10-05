'use client';

import { useState, useTransition } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui';
import { setPatientConsultorioAction } from './actions';
import type { SedeOption } from './sede';

/**
 * "Tratado en: [sede]" (Modo Sedes, MS2). Muestra la sede de atención del paciente y, si
 * el espectador es el tratante (editable), permite cambiarla. En cobertura/compartido la
 * vista es de solo lectura. Solo se renderiza cuando la org está en modo 'compartido'.
 */
export function TratadoEnCard({
  patientId,
  consultorios,
  currentConsultorioId,
  currentConsultorioName,
  editable,
}: {
  patientId: string;
  consultorios: SedeOption[];
  currentConsultorioId: string | null;
  currentConsultorioName: string | null;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentConsultorioId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await setPatientConsultorioAction(patientId, value);
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar la sede.');
        return;
      }
      setEditing(false);
    });
  };

  return (
    <div className="rounded-card border border-line bg-surface px-5 py-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin size={16} className="shrink-0 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tratado en</span>
          {!editing ? (
            currentConsultorioName ? (
              <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                {currentConsultorioName}
              </span>
            ) : (
              <span className="text-sm text-ink-soft">Sin sede asignada</span>
            )
          ) : null}
        </div>
        {editable && !editing ? (
          <button
            type="button"
            onClick={() => {
              setValue(currentConsultorioId ?? '');
              setEditing(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary"
          >
            <Pencil size={13} /> Cambiar
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <select
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Sin sede</option>
            {consultorios.map((consultorio) => (
              <option key={consultorio.id} value={consultorio.id}>
                {consultorio.name}
              </option>
            ))}
          </select>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              Cancelar
            </button>
            <Button
              size="sm"
              type="button"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
