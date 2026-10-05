/**
 * Motivo de marca "Reverberación": la onda concéntrica que emana de un punto-origen,
 * derivada del LogoMark (arcos a opacidad decreciente + punto fuente). Un solo lenguaje
 * gráfico, repetido con disciplina en separadores, anillos detrás de cifras/CTA y viñetas.
 */

/** Glifo de onda concéntrica (rizo desde un punto). Hereda color con currentColor. */
export function EchoGlyph({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="24" cy="24" r="20" opacity="0.18" />
      <circle cx="24" cy="24" r="13.5" opacity="0.4" />
      <circle cx="24" cy="24" r="7" opacity="0.7" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Separador de sección: un hairline que florece en el glifo de eco al centro
 * (reemplaza al border-line plano para que cada frontera lleve el sello de marca).
 */
export function EchoDivider({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-3 ${className}`}
    >
      <span className="h-px w-full max-w-56 bg-gradient-to-r from-transparent to-line" />
      <EchoGlyph size={24} className="shrink-0 text-primary dark:text-accent" />
      <span className="h-px w-full max-w-56 bg-gradient-to-l from-transparent to-line" />
    </div>
  );
}

/**
 * Anillos de eco que se propagan desde un punto-origen real (una cifra, un icono, un
 * CTA), reutilizando @keyframes pulse-ring. Reemplaza a los círculos border estáticos.
 * Decorativo y acotado al contenedor relativo padre. Hereda color con border-current.
 */
export function EchoRings({
  className = '',
  size = '8rem',
  count = 3,
  slow = false,
}: {
  className?: string;
  size?: string;
  count?: number;
  /** Anillos ambientales más lentos (9s) — para el fondo vivo, que no distraiga. */
  slow?: boolean;
}) {
  const ringAnim = slow ? 'animate-ring-slow' : 'animate-ring';
  const step = slow ? 3 : 1.5;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`${ringAnim} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-current`}
          style={{ height: size, width: size, animationDelay: `${i * step}s` }}
        />
      ))}
    </span>
  );
}
