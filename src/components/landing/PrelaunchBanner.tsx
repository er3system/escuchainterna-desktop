'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { subscribeNewsletterAction, type NewsletterState } from '@/app/newsletterActions';

/**
 * Banner de pre-lanzamiento en el tope de la landing: avisa que el sitio está
 * en desarrollo (aún sin servicio real) y captura el correo del visitante para
 * el boletín de avances. Ámbar = "en construcción" (coherente con el lenguaje
 * de color de la app). El formulario usa una server action nativa → funciona
 * aunque el JS no cargue (mejora progresiva), y el campo "empresa" es un
 * honeypot invisible para bots.
 */
export function PrelaunchBanner() {
  const [state, formAction, pending] = useActionState<NewsletterState, FormData>(
    subscribeNewsletterAction,
    {},
  );

  return (
    <aside
      aria-label="Aviso: sitio en desarrollo"
      className="relative z-40 border-b border-warning/30 bg-warning-soft text-ink dark:border-warning/40 dark:bg-[#2a2113] dark:text-[#fdeeca]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <p className="font-medium">
          <span aria-hidden="true" className="mr-1.5">
            🚧
          </span>
          Este sitio web está en desarrollo y no presta un servicio real por el momento. Te
          invitamos a estar pendiente de nuestro avance aquí:
        </p>

        {state.done ? (
          <p className="shrink-0 font-semibold text-warning dark:text-warning-soft">
            ¡Listo! Te escribiremos cuando haya novedades. 🌱
          </p>
        ) : (
          <form action={formAction} className="flex shrink-0 flex-col gap-1 sm:items-end">
            <div className="flex items-center gap-2">
              {/* Honeypot: invisible para humanos; los bots lo rellenan. */}
              <input
                type="text"
                name="empresa"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <label htmlFor="newsletter-email" className="sr-only">
                Tu correo electrónico
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                maxLength={254}
                placeholder="tu@correo.com"
                className="w-44 rounded-lg border border-warning/40 bg-surface px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-warning sm:w-52 dark:bg-[#1c1a14] dark:text-[#fdeeca]"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:bg-primary-dark disabled:opacity-60"
              >
                {pending ? 'Guardando…' : 'Avisarme'}
              </button>
            </div>
            <p className="text-xs text-ink-soft dark:text-[#c9b98a]">
              {state.error ? (
                <span className="font-medium text-danger">{state.error}</span>
              ) : (
                <>
                  Solo novedades del lanzamiento.{' '}
                  <Link href="/legal/privacidad" className="underline underline-offset-2">
                    Privacidad
                  </Link>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </aside>
  );
}
