'use client';

import { useActionState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { createSupervisionLinkAction, type CreateLinkState } from '../actions';

export interface SelectableMember {
  userId: string;
  label: string;
  canSupervise: boolean;
}

const SCOPE_OPTIONS = [
  { name: 'scopeNotas', label: 'Notas de sesión', defaultChecked: true },
  { name: 'scopeHistorias', label: 'Historias clínicas', defaultChecked: true },
  { name: 'scopePagos', label: 'Pagos (solo lectura)', defaultChecked: false },
];

/** Alta de vínculo profesor → supervisado con alcance configurable. */
export function CreateLinkForm({ members }: { members: SelectableMember[] }) {
  const [state, formAction, pending] = useActionState<CreateLinkState, FormData>(
    createSupervisionLinkAction,
    {},
  );
  const supervisors = members.filter((member) => member.canSupervise);

  if (supervisors.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Ningún miembro puede supervisar todavía. Crea un miembro con rol Profesor/a o activa el
        permiso &quot;Puede supervisar pacientes&quot; en la pestaña Miembros.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="vinculo-supervisor" className="mb-1 block text-sm font-medium text-ink">
          Supervisor/a
        </label>
        <select
          id="vinculo-supervisor"
          name="supervisorUserId"
          required
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        >
          {supervisors.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="vinculo-supervisado" className="mb-1 block text-sm font-medium text-ink">
          Miembro supervisado
        </label>
        <select
          id="vinculo-supervisado"
          name="supervisedUserId"
          required
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        >
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Alcance de la supervisión
        </legend>
        {SCOPE_OPTIONS.map((option) => (
          <label key={option.name} htmlFor={`vinculo-${option.name}`} className="flex items-center gap-2.5">
            <input
              id={`vinculo-${option.name}`}
              type="checkbox"
              name={option.name}
              defaultChecked={option.defaultChecked}
              className="h-4 w-4 rounded border-line accent-[#16181d]"
            />
            <span className="text-sm text-ink">{option.label}</span>
          </label>
        ))}
      </fieldset>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium text-success">Vínculo guardado.</p> : null}

      <Button type="submit" disabled={pending}>
        <Link2 size={16} /> {pending ? 'Guardando…' : 'Crear vínculo'}
      </Button>
      <p className="text-xs text-ink-soft">
        Si el vínculo ya existe entre esas dos personas, solo se actualiza su alcance.
      </p>
    </form>
  );
}
