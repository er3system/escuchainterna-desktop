'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Dir = 'up' | 'left' | 'right' | 'scale';

/** Estado oculto inicial según la dirección de entrada. SIN clase de transición → oculta
 *  al instante (no hay "fade-out"); la transición vive en SHOWN, así solo la ENTRADA anima. */
const HIDDEN: Record<Dir, string> = {
  up: 'translate-y-10 opacity-0',
  left: '-translate-x-10 opacity-0',
  right: 'translate-x-10 opacity-0',
  scale: 'scale-[0.96] opacity-0',
};

/** Estado visible final + la transición que anima la entrada desde HIDDEN. */
const SHOWN =
  'transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform translate-x-0 translate-y-0 scale-100 opacity-100';

/**
 * Revela su contenido al entrar en el viewport (IntersectionObserver) con un movimiento
 * direccional — la forma performante de "que al hacer scroll se vean animaciones" SIN
 * sumar animación continua (corre una vez y se desconecta). `dir` controla desde dónde
 * entra; `delay` (ms) escalona elementos en cascada. Respeta prefers-reduced-motion
 * (aparece de inmediato).
 *
 * RESILIENCIA: el contenido es VISIBLE por defecto (SSR y primer render del cliente ==
 * SHOWN → sin desajuste de hidratación). Solo DESPUÉS de montar (JS vivo) se oculta para
 * animar la entrada. Si la hidratación falla en el dispositivo del usuario, `mounted`
 * nunca pasa a true y la sección se ve igual — NUNCA queda en blanco. Este componente es
 * la causa raíz descartada de "la landing se ve vacía": antes renderizaba oculto en SSR y
 * dependía 100% de que el efecto cliente corriera para hacerse visible.
 */
export function Reveal({
  children,
  delay = 0,
  dir = 'up',
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  dir?: Dir;
  className?: string;
  as?: 'div' | 'li' | 'section';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Confirma que el JS montó: recién aquí se permite ocultar para animar la entrada.
    setMounted(true);
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Oculto SOLO cuando el JS ya montó y aún no toca revelar; en cualquier otro caso,
  // visible (resiliente ante fallo de hidratación).
  const hideNow = mounted && !shown;

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${hideNow ? HIDDEN[dir] : SHOWN} ${className}`}
    >
      {children}
    </Tag>
  );
}
