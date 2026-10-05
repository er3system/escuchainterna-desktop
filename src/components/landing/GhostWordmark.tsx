/**
 * "escuchainterna" en gigante, minúsculas, peso ligero, en lavanda muy tenue, DETRÁS
 * del contenido (aria-hidden + absolute → no afecta el layout ni provoca CLS). Eco del
 * wordmark fantasma del reel. Reutilizado en Hero y FinalCta. El tamaño/posición los
 * controla el llamador vía `className`; aquí solo van el texto, el color y el aria.
 */
export function GhostWordmark({
  className = '',
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'onInk';
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute select-none whitespace-nowrap font-display font-light lowercase leading-none tracking-tight ${
        tone === 'onInk' ? 'text-white/[0.05]' : 'text-primary/[0.07] dark:text-white/[0.06]'
      } ${className}`}
    >
      escuchainterna
    </span>
  );
}
