import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  GraduationCap,
  Laptop,
  School,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

interface Voice {
  icon: LucideIcon;
  role: string;
  quote: string;
}

/**
 * Pre-lanzamiento: en lugar de inventar testimonios de clientes que aún no existen
 * (engañoso y contraproducente con una audiencia clínica), la franja muestra PARA
 * QUIÉN está hecho EscuchaInterna, en su propia voz — una invitación a ser de los
 * primeros. Cuando haya reseñas reales, se sustituyen aquí (mismo formato: cita + rol).
 */
const VOICES: Voice[] = [
  {
    icon: UserRound,
    role: 'Psicóloga independiente',
    quote: 'Quiero dedicar mis tardes a mis pacientes, no a perseguir pagos y recordatorios.',
  },
  {
    icon: GraduationCap,
    role: 'Recién egresado',
    quote: 'Estoy abriendo mi consulta y quiero verme profesional desde el primer día, sin gastar de más.',
  },
  {
    icon: CalendarClock,
    role: 'Terapeuta con la agenda llena',
    quote: 'Entre sesión y sesión no me queda un minuto para la burocracia. Que se encargue sola.',
  },
  {
    icon: Building2,
    role: 'Clínica con equipo',
    quote: 'Coordino a varios terapeutas y necesito orden — sin que nadie vea el contenido clínico de otro.',
  },
  {
    icon: School,
    role: 'Supervisor universitario',
    quote: 'Acompaño a mis estudiantes y reviso su trabajo sin romper la confidencialidad del paciente.',
  },
  {
    icon: Laptop,
    role: 'Atención en línea y presencial',
    quote: 'Atiendo de las dos formas; quiero una sola herramienta que lo lleve todo.',
  },
];

function VoiceCard({ icon: Icon, role, quote, hidden }: Voice & { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="group mb-4 rounded-card border border-line bg-surface p-5 shadow-elev-sm transition-all duration-300 hover:border-primary/40 hover:shadow-elev-md"
    >
      <span aria-hidden="true" className="text-eco font-display text-3xl leading-none">
        &ldquo;
      </span>
      <p className="mt-1 text-pretty text-[15px] leading-relaxed text-ink">{quote}</p>
      <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
        <span className="bg-eco-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors duration-300 group-hover:text-white">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-ink">{role}</span>
      </div>
    </div>
  );
}

export function EarlyVoices() {
  return (
    <section className="overflow-hidden py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Izquierda: encabezado + invitación */}
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
              Sé de los primeros
            </p>
            <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Hecho para psicólogos como tú
            </h2>
            <p className="mt-4 text-pretty text-lg text-ink-soft">
              EscuchaInterna está abriendo sus puertas. Estos son los profesionales para quienes lo
              construimos — y a quienes invitamos a estrenarlo y a crecer con nosotros.
            </p>
            <div className="mt-8">
              <Link
                href="/registro"
                className="ease-spring inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.97]"
              >
                Empieza gratis — 7 días
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-sm text-ink-soft">
                Sin tarjeta · Estás a tiempo de ser de los primeros.
              </p>
            </div>
          </div>

          {/* Derecha: franja vertical que se desplaza sola y se pausa al pasar el cursor. */}
          <div className="marquee-mask-y pause-hover relative h-[26rem] overflow-hidden sm:h-[30rem]">
            <div className="animate-marquee-y flex flex-col">
              {VOICES.map((voice) => (
                <VoiceCard key={voice.role} {...voice} />
              ))}
              {/* Copia para el bucle continuo (oculta a lectores de pantalla). */}
              {VOICES.map((voice) => (
                <VoiceCard key={`dup-${voice.role}`} {...voice} hidden />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
