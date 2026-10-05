'use client';

import { useActionState, useState } from 'react';
import { AlarmClock, Plus, X } from 'lucide-react';
import { PatientPicker } from '@/components/patients/PatientPicker';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { createReminderAction, type ReminderFormState } from './actions';

const INITIAL: ReminderFormState = {};

export interface ReminderPatientOption {
  id: string;
  fullName: string;
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light';

/**
 * Crear recordatorio propio (v3 §12): título, nota, fecha/hora y paciente
 * opcional. Si lo crea un asistente, también se le crea al titular.
 */
export function NewReminderForm({
  patients,
  defaultPatientId = '',
  compact = false,
  searchable = false,
}: {
  patients: ReminderPatientOption[];
  /** Preselección al abrirse desde el expediente de un paciente. */
  defaultPatientId?: string;
  /** true: botón pequeño que despliega el formulario (card del expediente). */
  compact?: boolean;
  /**
   * true: usa el selector con BÚSQUEDA + "crear perfil rápido" (listas grandes, p. ej.
   * notificaciones o agenda). false: <select> simple (expediente, 1 paciente fijo).
   */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [state, dispatch, pending] = useActionState(createReminderAction, INITIAL);

  if (compact && !open) {
    return (
      <div>
        <Button variant="soft" size="sm" type="button" onClick={() => setOpen(true)}>
          <AlarmClock size={13} /> Recordatorio
        </Button>
        {state.ok ? <p className="mt-2 text-xs text-success">{state.ok}</p> : null}
      </div>
    );
  }

  return (
    <form action={dispatch} className="space-y-3">
      {compact ? (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Nuevo recordatorio</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar formulario de recordatorio"
            className="rounded-lg p-1 text-ink-soft hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="recordatorio-titulo">
          Título *
        </label>
        <Input
          id="recordatorio-titulo"
          name="titulo"
          type="text"
          required
          placeholder="P. ej. Llamar para confirmar la siguiente sesión"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="recordatorio-nota">
          Nota
        </label>
        <Textarea
          id="recordatorio-nota"
          name="nota"
          rows={2}
          placeholder="Detalle opcional del recordatorio"
        />
      </div>

      <div className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="recordatorio-fecha">
            Fecha y hora (visible desde entonces)
          </label>
          <input id="recordatorio-fecha" name="fecha" type="datetime-local" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="recordatorio-paciente">
            Paciente (opcional)
          </label>
          {searchable ? (
            <PatientPicker
              patients={patients}
              mode="single"
              fieldName="paciente"
              placeholder="Busca un paciente por nombre…"
              emptyHint="Aún no tienes pacientes. Crea uno rápido aquí abajo."
              defaultSelectedIds={defaultPatientId ? [defaultPatientId] : []}
            />
          ) : (
            <Select
              id="recordatorio-paciente"
              name="paciente"
              defaultValue={defaultPatientId}
            >
              <option value="">Sin paciente</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">{state.ok}</p> : null}

      <Button type="submit" disabled={pending}>
        <Plus size={15} /> {pending ? 'Creando…' : 'Crear recordatorio'}
      </Button>
    </form>
  );
}
