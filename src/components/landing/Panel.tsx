import type { ReactNode } from 'react';

type Tone = 'cream' | 'ink' | 'bare';

/**
 * Panel flotante de la landing: contenedor muy redondeado que "flota" sobre el lienzo
 * gris-lavanda (--color-canvas), alternando crema cálida y carbón (look del reel).
 * Presentacional, server, sin JS.
 *
 * - tone="cream": superficie crema, tinta oscura (la mayoría de secciones claras).
 * - tone="ink":   panel carbón, texto claro (StatRow, B2B, FinalCta, Footer).
 * - tone="bare":  sin caja ni fondo (cintas/marquee a sangre completa sobre el canvas).
 *
 * `data-wave-dark` lo leen la nav (para invertir su color) y los triggers de sección.
 */
export function Panel({
  children,
  tone = 'cream',
  id,
  className = '',
  ariaLabel,
}: {
  children: ReactNode;
  tone?: Tone;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  if (tone === 'bare') {
    return (
      <section id={id} aria-label={ariaLabel} className={className}>
        {children}
      </section>
    );
  }
  const dark = tone === 'ink';
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      data-wave-dark={dark ? '' : undefined}
      className={`relative mx-3 overflow-hidden rounded-[var(--radius-panel)] shadow-elev-lg dark:ring-1 dark:ring-white/[0.06] sm:mx-5 sm:rounded-[2.5rem] lg:mx-auto lg:max-w-[88rem] ${
        dark ? 'bg-panel-ink text-white' : 'bg-cream text-ink'
      } ${className}`}
    >
      {children}
    </section>
  );
}
