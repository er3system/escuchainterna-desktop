'use client';

import { useReverb } from './motion/useReverb';
import { REVERB_EASE } from './motion/gsap';

/**
 * Titular cinético: parte el texto en palabras (cada una un <span> EN EL MARKUP, así el
 * texto sigue siendo texto para SEO/lectores y el reposo es SIEMPRE visible). useReverb
 * anima la entrada (sube + aparece, escalonada) SOLO en la rama no-preference y tras
 * cargar las fuentes; con reduced-motion o sin JS, el titular se ve completo y legible.
 * Usa fromTo (destino explícito) para evitar el bug de from() bajo React StrictMode.
 */
export function KineticHeadline({
  text,
  className = '',
  dot = false,
}: {
  text: string;
  className?: string;
  dot?: boolean;
}) {
  const words = text.split(' ');
  const scope = useReverb(({ gsap }) => {
    const run = () => {
      gsap.fromTo(
        '[data-kw]',
        { yPercent: 45, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.75, ease: REVERB_EASE, stagger: 0.07 },
      );
      if (dot) {
        gsap.fromTo(
          '[data-kdot]',
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.15 + words.length * 0.07 },
        );
      }
    };
    // Se comprueba la EXISTENCIA de la Font Loading API (document.fonts), no la
    // promesa `ready` en sí (usar una promesa como condición booleana es un bug
    // clásico: siempre es truthy).
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  });

  return (
    <h1 ref={scope} className={className}>
      {words.map((word, index) => (
        <span key={index} data-kw className="inline-block will-change-transform">
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
      {dot ? (
        <span data-kdot className="inline-block text-accent">
          .
        </span>
      ) : null}
    </h1>
  );
}
