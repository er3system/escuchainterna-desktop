'use client';

import { useLayoutEffect, useRef, type DependencyList } from 'react';
import { ensureGsap } from './gsap';

type ReverbApi = ReturnType<typeof ensureGsap> & { self: HTMLElement };

/**
 * Coreografía GSAP acotada a un contenedor, con corte DURO de prefers-reduced-motion.
 * Toda la animación vive dentro de la rama '(prefers-reduced-motion: no-preference)'
 * de gsap.matchMedia(): si el usuario pide menos movimiento NO se crea ningún
 * ScrollTrigger ni tween, y el contenido queda en su estado de reposo — que SIEMPRE
 * debe ser visible en el markup. Corre en useLayoutEffect, así los from-states
 * (gsap.from/gsap.set con immediateRender) se aplican ANTES del paint: sin parpadeo.
 *
 * @param setup recibe { gsap, ScrollTrigger, self } y crea la animación dentro de un
 *   gsap.context() acotado al scopeRef (revert automático en el cleanup).
 * @returns scopeRef — colócalo en el contenedor raíz del componente.
 */
export function useReverb(setup: (api: ReverbApi) => void, deps: DependencyList = []) {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const { gsap, ScrollTrigger } = ensureGsap();
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        setup({ gsap, ScrollTrigger, self: el });
      }, el);
      return () => ctx.revert();
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}
