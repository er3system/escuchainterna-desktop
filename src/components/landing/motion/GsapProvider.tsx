'use client';

import { useEffect, type ReactNode } from 'react';
import { ensureGsap } from './gsap';

/**
 * Envuelve <main> de la landing. Registra GSAP una sola vez y —solo si el usuario NO
 * pide menos movimiento— marca el <html> con la clase `reverb-armed` (señal para CSS/
 * nav). Refresca ScrollTrigger cuando cargan las fuentes (Bricolage/Inter cambian
 * alturas) y en resize (con debounce), para que los triggers no se desfasen.
 *
 * No envuelve el contenido en ningún nodo extra (Fragment): cero impacto en el layout.
 */
export function GsapProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { ScrollTrigger } = ensureGsap();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    if (!reduce) root.classList.add('reverb-armed');

    let timer: number | undefined;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    window.addEventListener('resize', onResize);
    // Las fuentes cambian alturas al cargar → refresca los triggers cuando estén listas.
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});

    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
      root.classList.remove('reverb-armed');
    };
  }, []);

  return <>{children}</>;
}
