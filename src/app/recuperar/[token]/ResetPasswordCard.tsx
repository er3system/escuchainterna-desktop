'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { resetPasswordAction, type ResetPasswordState } from '../actions';

const INITIAL: ResetPasswordState = {};

export function ResetPasswordCard({ token }: { token: string }) {
  const [state, dispatch, pending] = useActionState(resetPasswordAction, INITIAL);

  return (
    <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-card">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <p className="text-2xl font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">Crea una nueva contraseña</h1>
      </div>

      {state.done ? (
        <div className="space-y-4 text-center">
          <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-left text-sm text-success">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.</p>
          </div>
          <Link
            href="/login"
            className="inline-block w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      ) : (
        <form action={dispatch} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <Input
            type="password"
            name="password"
            required
            minLength={6}
            aria-label="Nueva contraseña"
            placeholder="Nueva contraseña (mínimo 6 caracteres) *"
            autoComplete="new-password"
          />
          <Input
            type="password"
            name="confirmacion"
            required
            minLength={6}
            aria-label="Confirmar contraseña"
            placeholder="Confirma la nueva contraseña *"
            autoComplete="new-password"
          />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" size="lg" disabled={pending} className="w-full px-4">
            {pending ? 'Guardando…' : 'Guardar nueva contraseña'}
          </Button>
        </form>
      )}

      {!state.done ? (
        <p className="mt-4 text-center text-xs text-ink-soft">
          El enlace expira 1 hora después de haberse generado y solo puede usarse una vez.
        </p>
      ) : null}
    </div>
  );
}
