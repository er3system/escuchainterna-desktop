import type { ReactNode } from 'react';
import { EchoGlyph } from './Echo';

/**
 * Eyebrow en versalitas (el "OUR APPROACH" del reel), con glifo de onda opcional.
 * Unifica el patrón repetido de cabecera de sección y lo eleva al look del reel.
 * tone="light" para paneles oscuros (lavanda claro), "primary" para paneles claros.
 */
export function Eyebrow({
  children,
  glyph = false,
  tone = 'primary',
  className = '',
}: {
  children: ReactNode;
  glyph?: boolean;
  tone?: 'primary' | 'light';
  className?: string;
}) {
  return (
    <p
      className={`inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] ${
        tone === 'light' ? 'text-primary-light' : 'text-primary dark:text-accent-2'
      } ${className}`}
    >
      {glyph ? <EchoGlyph size={14} className="opacity-70" /> : null}
      {children}
    </p>
  );
}
