'use client';

import type { ReactNode } from 'react';
import { useReverb } from './motion/useReverb';

/**
 * Parallax por scroll: desplaza su contenido a distinta velocidad que la página (efecto
 * de profundidad al bajar). GSAP scrub SIN pin → no secuestra el scroll. Estado de reposo
 * = sin transform (visible/normal), así que sin JS / con reduced-motion no pasa nada raro
 * (useReverb solo monta en la rama no-preference). `speed` = yPercent al recorrer la vista
 * (negativo = sube; sutil por defecto).
 */
export function Parallax({
  children,
  speed = -8,
  className = '',
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const scope = useReverb(({ gsap, self }) => {
    gsap.to(self, {
      yPercent: speed,
      ease: 'none',
      scrollTrigger: { trigger: self, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
