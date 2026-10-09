'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { loginAction, type AuthFormState } from './actions';

const INITIAL: AuthFormState = {};

export function LoginCard({ desktopEdition = false, rememberedEmail = '' }: { desktopEdition?: boolean; rememberedEmail?: string }) {
  const [state, dispatch, pending] = useActionState(loginAction, INITIAL);
  const [email, setEmail] = useState(rememberedEmail);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  async function recoverAccount(): Promise<void> {
    if (!email.trim()) { setRecoveryError('Escribe arriba el correo de tu cuenta local.'); return; }
    const bridge = (window as Window & { escuchaDesktop?: { recoverLocalAccount(email: string): Promise<void> } }).escuchaDesktop;
    if (!bridge?.recoverLocalAccount) { setRecoveryError('Para recuperar tu cuenta local, abre EscuchaInterna desde su acceso directo en Windows.'); return; }
    setRecovering(true);
    setRecoveryError('');
    try { await bridge.recoverLocalAccount(email.trim().toLowerCase()); }
    catch { setRecoveryError('No se pudo abrir la recuperación. Revisa el correo y vuelve a intentarlo.'); }
    finally { setRecovering(false); }
  }

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
          value={email}
          onChange={event => setEmail(event.target.value)}
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
        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-bg p-3 text-sm text-ink">
          <input type="checkbox" name="rememberAccount" value="yes" defaultChecked={!!rememberedEmail} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>Recordar cuenta en esta PC<span className="mt-0.5 block text-xs text-ink-soft">Guarda tu correo y mantiene la sesión hasta 30 días. Úsalo en tu equipo personal.</span></span>
        </label>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" size="lg" disabled={pending || recovering} className="w-full">
          {pending ? 'Un momento…' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-sm">
        {desktopEdition ? <button type="button" disabled={pending || recovering} onClick={recoverAccount} className="w-full font-medium text-primary hover:underline disabled:opacity-60 dark:text-accent-2">
          {recovering ? 'Preparando recuperación…' : '¿Olvidaste tu contraseña?'}
        </button> : <Link href="/recuperar" className="block font-medium text-primary dark:text-accent-2 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>}
        {recoveryError ? <p role="alert" className="text-sm text-danger">{recoveryError}</p> : null}
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
