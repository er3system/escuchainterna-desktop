'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { verifyTotpAction, type AuthFormState } from '../actions';

const INITIAL: AuthFormState = {};

export function TotpCard() {
  const [state, dispatch, pending] = useActionState(verifyTotpAction, INITIAL);

  return (
    <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-card">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <p className="text-2xl font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
        <span className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
          <ShieldCheck size={22} />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-ink">Verificación en dos pasos</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Escribe el código de 6 dígitos de tu app de autenticación.
        </p>
      </div>

      <form action={dispatch} className="space-y-3">
        <Input
          type="text"
          name="codigo"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          autoFocus
          className="text-center text-lg tracking-[0.4em]"
        />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button
          type="submit"
          disabled={pending}
          className="w-full py-2.5"
        >
          {pending ? 'Verificando…' : 'Verificar y entrar'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿No puedes acceder a tu app?{' '}
        <Link href="/login" className="font-medium text-primary dark:text-accent-2 hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
