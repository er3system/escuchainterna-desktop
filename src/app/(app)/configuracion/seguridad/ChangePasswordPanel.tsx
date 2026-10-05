'use client';

import { useActionState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { changePasswordAction, type ChangePasswordState } from './passwordActions';

const INITIAL: ChangePasswordState = {};

export function ChangePasswordPanel() {
  const [state, dispatch, pending] = useActionState(changePasswordAction, INITIAL);

  return (
    <Card>
      <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
        <KeyRound size={14} /> Cambiar contraseña
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Mínimo 10 caracteres con al menos una letra y un número. Al cambiarla se cerrarán tus otras
        sesiones abiertas.
      </p>

      {state.ok ? (
        <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          Contraseña actualizada. Tus otras sesiones se cerraron.
        </p>
      ) : null}

      <form action={dispatch} className="mt-3 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Contraseña actual</span>
          <Input type="password" name="actual" required autoComplete="current-password" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Nueva contraseña</span>
          <Input type="password" name="nueva" required minLength={10} autoComplete="new-password" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Confirmar nueva contraseña</span>
          <Input
            type="password"
            name="confirmacion"
            required
            minLength={10}
            autoComplete="new-password"
            className="mt-1"
          />
        </label>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </Card>
  );
}
