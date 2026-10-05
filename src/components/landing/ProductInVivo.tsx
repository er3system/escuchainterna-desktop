'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, CreditCard, MessageCircle, type LucideIcon } from 'lucide-react';
import { Eyebrow } from './Eyebrow';
import { EchoRings } from './Echo';

interface Act {
  n: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const ACTS: Act[] = [
  {
    n: '01',
    icon: CalendarClock,
    title: 'Recibe la reserva',
    desc: 'Tu paciente reserva en tu página pública y la cita queda agendada al instante — sin idas y venidas por chat.',
  },
  {
    n: '02',
    icon: MessageCircle,
    title: 'Recuerda por WhatsApp',
    desc: 'El recordatorio sale solo el día anterior. Menos ausencias, y tú no moviste un dedo.',
  },
  {
    n: '03',
    icon: CreditCard,
    title: 'Recibe el pago',
    desc: 'Registras el cobro y el ingreso del mes se actualiza al instante. La consulta, al día.',
  },
];

/** Escenario que muestra el acto activo (cross-fade por opacidad/posición; CSS puro). */
function DemoStage({ active }: { active: number }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] border border-line bg-[#e9ece0] dark:bg-[#101216] shadow-elev-lg">
      <div className="absolute right-4 top-4 z-20 text-[8px] font-medium uppercase tracking-[0.14em] text-ink-soft">
        Vista de ejemplo
      </div>

      {/* Acto 1 — Cita confirmada */}
      <div
        className={`absolute inset-0 grid place-items-center p-8 transition-all duration-500 ${
          active === 0 ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-elev-md">
          <p className="mb-3 text-xs font-semibold text-ink-soft">Agenda · hoy</p>
          <div className="flex items-center gap-3">
            <span className="w-9 text-xs font-bold text-accent-strong dark:text-accent-2">13:00</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 dark:bg-accent/35 text-xs font-bold text-accent-strong dark:text-accent-2">
              A
            </span>
            <span className="flex-1 text-sm font-medium text-ink">Ana Sofía Peralta</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-1 text-[10px] font-semibold text-primary">
              <Check className="h-3 w-3" /> Agendada
            </span>
          </div>
        </div>
      </div>

      {/* Acto 2 — Recordatorio WhatsApp */}
      <div
        className={`absolute inset-0 grid place-items-center p-8 transition-all duration-500 ${
          active === 1 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <div className="w-full max-w-xs">
          <div className="ml-auto max-w-[15rem] rounded-2xl rounded-br-sm bg-success-soft p-3 text-sm text-ink shadow-card">
            Hola Ana, te recordamos tu cita de mañana a las 13:00 con la Dra. Valeria. ¡Te esperamos!
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-medium text-success">
              Enviado <Check className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <MessageCircle className="h-3.5 w-3.5 text-success" /> Recordatorio automático por WhatsApp
          </p>
        </div>
      </div>

      {/* Acto 3 — Pago recibido + reverberación */}
      <div
        className={`absolute inset-0 grid place-items-center p-8 transition-all duration-500 ${
          active === 2 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <div className="relative w-full max-w-xs rounded-2xl bg-surface p-4 shadow-elev-md">
          {active === 2 ? <EchoRings className="text-accent/40" size="13rem" count={3} /> : null}
          <div className="relative flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 dark:bg-accent/35 text-accent-strong dark:text-accent-2">
              <CreditCard className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink">Pago recibido</span>
            <span className="ml-auto font-display text-sm font-extrabold text-ink tabular-nums">$180.000 COP</span>
          </div>
          <p className="relative mt-3 text-[11px] font-medium text-ink-soft">Ingresos del mes</p>
          <div className="relative mt-1 flex h-12 items-end gap-1.5">
            {[40, 55, 38, 70, 52, 84, 66, 100].map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t ${i === 7 ? 'bg-accent' : 'bg-accent/25'}`}
              />
            ))}
          </div>
          <p className="relative mt-1 font-display text-base font-extrabold text-ink tabular-nums">$6.450.000 COP</p>
        </div>
      </div>
    </div>
  );
}

/**
 * PIEZA FIRMA "Míralo hacer el trabajo": el producto se demuestra SOLO mientras bajas.
 * Scrollytelling robusto = pasos altos a la izquierda + un escenario STICKY a la derecha
 * (CSS sticky, no pin de GSAP → cero secuestro de scroll ni jank), y un IntersectionObserver
 * marca el acto activo (no depende de rAF, funciona siempre). En móvil los pasos se apilan
 * y cada uno trae su mini-escenario. prefers-reduced-motion: las transiciones se neutralizan
 * (globals) pero los estados quedan visibles y legibles.
 */
export function ProductInVivo() {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number(entry.target.getAttribute('data-step')));
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    steps.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="en-vivo" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow glyph>En vivo</Eyebrow>
        <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          “Del resto nos encargamos”, demostrado
        </h2>
        <p className="mt-4 text-lg text-ink-soft">
          Baja y míralo trabajar solo: de la reserva al recordatorio al cobro, sin que muevas un dedo.
        </p>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Pasos que se recorren con el scroll. */}
        <div ref={stepsRef} className="flex flex-col gap-10 lg:gap-[48vh] lg:py-[24vh]">
          {ACTS.map((act, i) => (
            <div
              key={act.n}
              data-step={i}
              className={`transition-all duration-500 ${active === i ? 'opacity-100' : 'lg:opacity-40'}`}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${
                    active === i ? 'bg-accent text-white' : 'bg-primary-light text-accent-strong'
                  }`}
                >
                  <act.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-display text-2xl font-extrabold tracking-tight text-ink/30 tabular-nums">
                  {act.n}
                </span>
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">{act.title}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink-soft">{act.desc}</p>

              {/* Mini-escenario inline solo en móvil (en lg manda el sticky). */}
              <div className="mt-5 lg:hidden">
                <DemoStage active={i} />
              </div>
            </div>
          ))}
        </div>

        {/* Escenario STICKY (solo lg): se queda en vista mientras recorres los pasos. */}
        <div className="hidden lg:block">
          <div className="sticky top-[18vh]">
            <DemoStage active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
