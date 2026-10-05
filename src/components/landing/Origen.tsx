import Image from 'next/image';
import { EchoGlyph, EchoRings } from './Echo';
import { Parallax } from './Parallax';

/**
 * Sección "Origen": la historia del fundador en primera persona, entre el Manifesto
 * y las voces tempranas. Da rostro y motivo humano al producto (confianza con una
 * audiencia clínica). Misma dirección de arte "Reverberación": display Bricolage,
 * acento de eco, aura suave de marca.
 *
 * FOTO: retrato del fundador en public/fundador.jpg, servido optimizado con next/image
 * (recorte cuadrado object-cover, 1600x1600 original).
 */
export function Origen() {
  return (
    <section id="origen" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="bg-aura animate-aura pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 opacity-40"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
        {/* Retrato (parallax sutil: flota al hacer scroll). */}
        <Parallax speed={-14} className="relative mx-auto w-full max-w-[18rem]">
          <EchoRings className="text-accent/20" size="28rem" />
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-line shadow-elev-lg">
            <Image
              src="/fundador.jpg"
              alt="David Silva, fundador de EscuchaInterna"
              fill
              sizes="288px"
              className="object-cover"
            />
          </div>
          {/* Sello de eco sobre la esquina del retrato. */}
          <span className="absolute -bottom-3 -right-3 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-accent-strong dark:text-accent-2 shadow-elev-md">
            <EchoGlyph size={22} />
          </span>
        </Parallax>

        {/* Texto */}
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-soft">
            <EchoGlyph size={16} className="text-accent-strong dark:text-accent-2" /> Origen
          </span>

          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            Hecho por un psicólogo, <span className="text-eco">para psicólogos.</span>
          </h2>

          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
            <p>
              Soy <strong className="font-semibold text-ink">David Silva</strong>, psicólogo. Antes
              de escribir una sola línea de EscuchaInterna, probé las herramientas que ya existían.
              Varias eran muy buenas —pulidas, completas—, pero ninguna se sentía pensada desde la
              consulta: les faltaba la intuición de quien de verdad se sienta frente a un paciente.
            </p>
            <p>
              Así que me propuse construir la que a mí me habría gustado tener. No una plataforma de
              gestión más, sino una que entiende cómo trabaja un psicólogo —de la primera cita a la
              historia clínica— y que sabe quitarse del camino para que hagas lo único que nadie más
              puede hacer: escuchar.
            </p>
          </div>

          <blockquote className="mt-7 border-l-2 border-primary dark:border-accent-2/60 pl-4 font-display text-xl font-semibold leading-snug text-ink">
            EscuchaInterna es, sencillamente, el software que yo quería usar.
          </blockquote>

          <figcaption className="mt-7 flex items-center gap-3">
            <span className="h-px w-8 bg-line" />
            <span>
              <span className="block font-semibold text-ink">David Silva</span>
              <span className="block text-sm text-ink-soft">
                Psicólogo · Fundador de EscuchaInterna
              </span>
            </span>
          </figcaption>
        </div>
      </div>
    </section>
  );
}
