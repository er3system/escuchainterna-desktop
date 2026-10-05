import { EchoRings } from './Echo';

/**
 * Fondo VIVO de la landing: la onda "Reverberación" + una aurora salvia que se mueven
 * CONTINUAMENTE detrás de todo el contenido. CSS puro (corre en el navegador real).
 * Fijo al viewport. RENDIMIENTO: sin `filter: blur` (es lo que más cuesta recomponer al
 * hacer scroll → jank); la suavidad la da la aurora de gradientes radiales, y solo animan
 * transform/opacity. Muy SUTIL para no pisar el texto en tinta. Decorativo (aria-hidden);
 * con prefers-reduced-motion las animaciones se neutralizan (globals) → fondo estático.
 */
export function LivingBackground() {
  return (
    <div
      aria-hidden="true"
      data-living-bg
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base con PROFUNDIDAD (no plano): blanco-limpio arriba → velo salvia abajo, con un
          resplandor salvia tenue tras el hero. Armoniza el "fondo de más atrás" con la marca. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-8%,#f8f9f4_0%,transparent_55%),radial-gradient(90%_60%_at_85%_8%,rgba(147,163,104,0.10),transparent_60%),linear-gradient(180deg,#f5f6f1_0%,#eaeee2_100%)] dark:bg-[radial-gradient(120%_80%_at_50%_-8%,rgba(147,163,104,0.05)_0%,transparent_55%),radial-gradient(90%_60%_at_85%_8%,rgba(147,163,104,0.07),transparent_60%),linear-gradient(180deg,#14161c_0%,#0b0c11_100%)]" />

      {/* Malla/aurora salvia que deriva lentamente (gradientes radiales suaves, sin blur). */}
      <div className="bg-aura animate-aura absolute -inset-[15%] opacity-60" />

      {/* Dos focos de Reverberación: anillos concéntricos lentos que emanan sin parar. */}
      <span className="absolute left-[20%] top-[26%] text-accent/[0.10]">
        <EchoRings size="34rem" count={3} slow />
      </span>
      <span className="absolute bottom-[18%] right-[22%] text-[var(--color-accent-strong)]/[0.10] dark:text-accent-2/[0.12]">
        <EchoRings size="26rem" count={3} slow />
      </span>
    </div>
  );
}
