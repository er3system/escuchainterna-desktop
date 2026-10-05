import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  FolderHeart,
  MessageCircle,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { KineticHeadline } from './KineticHeadline';

const PILLS: { icon: LucideIcon; label: string }[] = [
  { icon: CalendarClock, label: 'Agenda' },
  { icon: FolderHeart, label: 'Expediente + CIE-11' },
  { icon: MessageCircle, label: 'Recordatorios' },
  { icon: CreditCard, label: 'Pagos' },
  { icon: Sparkles, label: 'Asistente IA' },
];

const CHECKS = ['Sin tarjeta de crédito', 'Cancela cuando quieras', 'Tus datos son tuyos'];

/** Etiqueta flotante sobre el visual orgánico (capacidad real del producto). */
function FloatLabel({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`absolute inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-4 pr-1.5 text-sm font-medium text-ink shadow-elev-md ${className}`}
    >
      {label}
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[var(--color-accent-strong)]">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </span>
  );
}

/**
 * Visual orgánico propio (SVG, sin imágenes externas): la onda "Reverberación" hecha
 * viva — anillos concéntricos en salvia que emanan de un punto-origen, venas orgánicas
 * y blobs suaves. Estado de reposo visible (no depende de JS); decorativo (aria-hidden).
 */
function OrganicWave() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 380"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <circle cx="205" cy="150" r="44" fill="none" stroke="#93a368" strokeWidth="1.3" opacity="0.9" />
      <circle cx="205" cy="150" r="86" fill="none" stroke="#93a368" strokeWidth="1.2" opacity="0.6" />
      <circle cx="205" cy="150" r="134" fill="none" stroke="#93a368" strokeWidth="1.1" opacity="0.4" />
      <circle cx="205" cy="150" r="188" fill="none" stroke="#93a368" strokeWidth="1" opacity="0.25" />
      <circle cx="205" cy="150" r="246" fill="none" stroke="#93a368" strokeWidth="1" opacity="0.14" />
      <path
        d="M30 300 C 120 250, 130 150, 205 150 C 280 150, 290 60, 350 36"
        fill="none"
        stroke="#6f7f4a"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M52 360 C 150 320, 170 240, 240 248 C 290 254, 312 196, 350 172"
        fill="none"
        stroke="#aab784"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <ellipse cx="120" cy="250" rx="96" ry="66" fill="#93a368" opacity="0.16" />
      <ellipse cx="250" cy="104" rx="84" ry="60" fill="#7e9050" opacity="0.13" />
      <circle cx="205" cy="150" r="6" fill="#93a368" />
    </svg>
  );
}

/**
 * Hero estilo limpio-orgánico (paleta tinta + salvia): titular en tinta SÓLIDA sobre
 * papel (contraste alto, legible), el acento salvia solo en el punto y la decoración.
 * La onda orgánica vive en la tarjeta derecha, nunca detrás del texto. Entrada con
 * `animate-rise` (CSS, fill:both → siempre termina visible; respeta reduced-motion).
 */
export function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="animate-rise">
          <KineticHeadline
            text="Dedica tu energía a la terapia"
            dot
            className="text-balance font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-5xl lg:text-[3.75rem]"
          />
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Del resto nos encargamos: agenda, expediente, recordatorios por WhatsApp, pagos y un
            asistente de IA que solo conoce a tus pacientes.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/registro"
              className="sheen ease-spring inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.97]"
            >
              Empieza gratis — 7 días
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/#caracteristicas"
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3.5 text-base font-semibold text-ink transition-colors hover:text-[var(--color-accent-strong)] dark:hover:text-accent-2"
            >
              Ver características
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {CHECKS.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                {c}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {PILLS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink shadow-card"
              >
                <Icon className="h-4 w-4 text-[var(--color-accent-strong)] dark:text-accent-2" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="animate-rise" style={{ animationDelay: '0.12s' }}>
          <div className="relative aspect-[5/6] w-full overflow-hidden rounded-[1.75rem] border border-line bg-[#e9ece0] dark:bg-[#101216] shadow-elev-lg sm:aspect-[4/3] lg:aspect-square">
            <OrganicWave />

            <FloatLabel label="Expediente" className="left-5 top-6" />
            <FloatLabel label="Agenda" className="right-5 top-1/3" />
            <FloatLabel label="Asistente IA" className="left-8 top-[58%]" />

            <div className="absolute bottom-4 right-4 w-48 rounded-2xl bg-surface p-3 shadow-elev-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">Ingresos del mes</span>
                <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                  Vista de ejemplo
                </span>
              </div>
              <p className="font-display text-xl font-extrabold text-ink tabular-nums">$6.450.000</p>
              <svg viewBox="0 0 180 46" className="mt-1 h-10 w-full" aria-hidden="true">
                <path
                  d="M0 40 C 32 36, 44 22, 74 25 C 106 28, 118 9, 180 5 L 180 46 L 0 46 Z"
                  fill="#93a368"
                  opacity="0.22"
                />
                <path
                  d="M0 40 C 32 36, 44 22, 74 25 C 106 28, 118 9, 180 5"
                  fill="none"
                  stroke="#6f7f4a"
                  strokeWidth="2"
                />
              </svg>
              <div className="mt-1 flex gap-3 text-[9px] text-ink-soft">
                <span>
                  <b className="text-ink">19</b> pacientes
                </span>
                <span>
                  <b className="text-ink">3</b> hoy
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
