'use client';

import { useActionState } from 'react';
import { Headset, KeyRound, Plus } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { createReceptionAction, type CreateReceptionState } from '../actions';
import type { OrgConsultorio } from '../orgData';

const INITIAL: CreateReceptionState = {};

export function CreateReceptionForm({ consultorios }: { consultorios: OrgConsultorio[] }) {
  const [state, dispatch, pending] = useActionState(createReceptionAction, INITIAL);

  if (state.ok && state.temporaryPassword) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <Headset size={16} /> Recepción creada
        </div>
        <p className="text-sm text-ink-soft">
          Comparte estos datos con <span className="font-medium text-ink">{state.receptionName}</span>. La
          contraseña se muestra <span className="font-medium">una sola vez</span>.
        </p>
        <div className="rounded-lg border border-line bg-bg p-3 text-sm">
          <p className="text-ink">
            <span className="text-ink-soft">Correo:</span> {state.receptionEmail}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-ink">
            <KeyRound size={14} className="text-primary" />
            <span className="text-ink-soft">Contraseña temporal:</span>{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">{state.temporaryPassword}</code>
          </p>
        </div>
        <p className="text-xs text-ink-soft">Recarga la página para crear otra cuenta de recepción.</p>
      </div>
    );
  }

  return (
    <form action={dispatch} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="reception-name">
          Nombre *
        </label>
        <Input id="reception-name" name="fullName" type="text" required placeholder="Nombre de la recepción" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="reception-email">
          Correo *
        </label>
        <Input id="reception-email" name="email" type="email" required placeholder="recepcion@correo.com" />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-ink-soft">Consultorios que atiende *</legend>
        <div className="space-y-1.5">
          {consultorios.map((consultorio) => (
            <label key={consultorio.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="consultorioId"
                value={consultorio.id}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {consultorio.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        <Plus size={15} /> {pending ? 'Creando…' : 'Crear recepción'}
      </Button>
    </form>
  );
}
