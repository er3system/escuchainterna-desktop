'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LogoMark } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { loginAction, type AuthFormState } from './actions';

const INITIAL: AuthFormState = {};

export function LoginCard({ desktopEdition = false }: { desktopEdition?: boolean }) {
  const [state, dispatch, pending] = useActionState(loginAction, INITIAL);

  return (
    <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-card">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <p className="text-2xl font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">Bienvenido/a</h1>
        <p className="mt-1 text-sm text-ink-soft">{desktopEdition ? 'EscuchaInterna para PC · Inicia sesión en tu cuenta local' : 'Inicia sesión para continuar'}</p>
      </div>

      <form action={dispatch} className="space-y-3">
        <Input
          type="email"
          name="email"
          required
          aria-label="Correo electrónico"
          placeholder="Correo electrónico *"
          autoComplete="email"
        />
        <Input
          type="password"
          name="password"
          required
          minLength={6}
          aria-label="Contraseña"
          placeholder="Contraseña *"
          autoComplete="current-password"
        />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? 'Un momento…' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-sm">
        {desktopEdition ? null : <Link href="/recuperar" className="block font-medium text-primary dark:text-accent-2 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>}
        <p className="text-ink-soft">
          ¿Primera vez aquí?{' '}
          <Link href="/registro" className="font-medium text-primary dark:text-accent-2 hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      </div>
      {desktopEdition ? <p className="mt-4 border-t border-line pt-4 text-center text-xs text-ink-soft">Esta cuenta pertenece a esta instalación. Tus datos se guardan en esta PC y no se sincronizan con la web.</p> : null}
    </div>
  );
}
