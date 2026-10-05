'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { requestPasswordResetAction, type RequestResetState } from './actions';

const INITIAL: RequestResetState = {};

export function RequestResetCard({ emailUnavailable = false }: { emailUnavailable?: boolean }) {
  const [state, dispatch, pending] = useActionState(requestPasswordResetAction, INITIAL);

  // Producción sin proveedor de correo: prometer "te enviaremos un enlace"
  // sería falso (el correo nunca llega). Se ofrece la vía de soporte.
  if (emailUnavailable) {
    return (
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-card">
        <div className="mb-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <LogoMark size={30} />
            <p className="text-2xl font-bold tracking-tight text-ink">
              escucha<span className="text-primary dark:text-accent-2">interna</span>
            </p>
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">Recupera tu contraseña</h1>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">
          La recuperación automática por correo aún no está disponible. Escríbenos a{' '}
          <a
            href="mailto:hola@escuchainterna.com?subject=Recuperar%20contrase%C3%B1a"
            className="font-semibold text-primary hover:underline dark:text-accent-2"
          >
            hola@escuchainterna.com
          </a>{' '}
          desde el correo con el que te registraste y te ayudamos a restablecerla.
        </p>
        <p className="mt-4 text-center">
          <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
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
        <h1 className="mt-4 text-lg font-semibold text-ink">Recupera tu contraseña</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Te enviaremos un enlace por correo para crear una nueva contraseña.
        </p>
      </div>

      {state.done ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
            <MailCheck size={18} className="mt-0.5 shrink-0" />
            <p>
              Si el correo está registrado, recibirás un enlace de recuperación válido por 1 hora.
            </p>
          </div>
          {state.resetUrl ? (
            <div className="rounded-lg border border-dashed border-line bg-bg p-3 text-sm">
              <p className="mb-1 text-xs text-ink-soft">
                (modo local: este enlace llegaría por correo)
              </p>
              <a href={state.resetUrl} className="break-all font-medium text-primary dark:text-accent-2 hover:underline">
                {state.resetUrl}
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <form action={dispatch} className="space-y-3">
          <Input
            type="email"
            name="email"
            required
            aria-label="Correo electrónico"
            placeholder="Correo electrónico *"
            autoComplete="email"
          />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" size="lg" disabled={pending} className="w-full px-4">
            {pending ? 'Generando enlace…' : 'Enviar enlace de recuperación'}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-primary dark:text-accent-2 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
