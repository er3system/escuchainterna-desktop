import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { EchoRings } from './Echo';

export function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal
          as="div"
          className="animate-gradient relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-primary),var(--color-accent-strong)_55%,#000)] bg-[length:200%_200%] px-6 py-16 text-center sm:px-16 sm:py-20"
        >

          <h2 className="relative mx-auto max-w-2xl font-display text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Empieza hoy a transformar tu consulta
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/80">
            Sé de los primeros psicólogos en dedicar su energía a la terapia, no a la
            administración.
          </p>
          <div className="relative mt-9 flex justify-center">
            {/* El CTA es la fuente: el eco se propaga desde el botón. */}
            <span className="relative inline-flex">
              <EchoRings className="text-white/30" size="13rem" />
              <Link
                href="/registro"
                className="sheen relative inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-primary shadow-card transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.3)]"
              >
                Crea tu consulta en EscuchaInterna
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </span>
          </div>
          <p className="relative mt-5 text-sm text-white/70">
            Sin tarjeta de crédito · Cancela cuando quieras · Tus datos siempre son tuyos
          </p>
        </Reveal>
      </div>
    </section>
  );
}
