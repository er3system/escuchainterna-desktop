'use client';

import { useEffect, useState } from 'react';

/**
 * Barra sutil de progreso de lectura, fija en el borde superior del área de
 * contenido (a la derecha del sidebar, que mide 15rem = left-60).
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed left-60 right-0 top-0 z-40 h-1">
      <div
        className="h-full rounded-r-full bg-primary/80 transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
