import { EchoRings } from './Echo';

/**
 * Momento de respiro entre bloques densos: UNA frase grande sobre mucho aire, con el
 * motivo de eco propagándose desde el centro. El vacío intencional como recurso de
 * marca (lo contrario del grid de tarjetas) — calma y carácter.
 */
export function Manifesto() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div
        aria-hidden="true"
        className="bg-aura animate-aura pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 opacity-40 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span className="relative inline-flex">
          <EchoRings className="text-primary/15 dark:text-accent/15" size="24rem" />
          <h2 className="relative font-display text-balance text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            Escuchar es tu trabajo.{' '}
            <span className="text-eco">Lo demás es el nuestro.</span>
          </h2>
        </span>
      </div>
    </section>
  );
}
