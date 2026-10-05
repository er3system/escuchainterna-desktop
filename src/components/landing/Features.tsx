import {
  Building2,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FolderHeart,
  MessageCircle,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from './Reveal';
import { TiltCard } from './TiltCard';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: CalendarDays,
    title: 'Agenda inteligente',
    description:
      'Disponibilidad por horarios, citas recurrentes, reagendamientos y tu propia página pública de reservas.',
  },
  {
    icon: MessageCircle,
    title: 'Recordatorios por WhatsApp',
    description:
      'Confirmaciones y recordatorios automáticos que reducen las ausencias sin que muevas un dedo.',
  },
  {
    icon: FolderHeart,
    title: 'Expediente clínico con CIE-11',
    description:
      'Notas de sesión, archivos, mapa familiar y diagnósticos con el catálogo CIE-11 integrado.',
  },
  {
    icon: ClipboardList,
    title: 'Historia clínica tipo formulario',
    description:
      'Plantillas flexibles listas para usar — o crea las tuyas a la medida de tu enfoque terapéutico.',
  },
  {
    icon: Wallet,
    title: 'Pagos y finanzas',
    description:
      'Controla cobros, tarifas por inasistencia, recordatorios de pago, recibos y métricas de ingresos.',
  },
  {
    icon: Sparkles,
    title: 'Asistente de IA',
    description:
      'Apoyo clínico con acceso exclusivo a tus propios pacientes. Sugiere; tú siempre apruebas.',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca EscuchaInterna',
    description:
      'Publicaciones sobre modelos terapéuticos, temas clínicos y marcos normativos de cada país.',
  },
  {
    icon: Building2,
    title: 'Para equipos y formación',
    description:
      'Perfiles maestros, supervisión de practicantes y permisos por miembro para equipos completos.',
  },
];

export function Features() {
  return (
    <section id="caracteristicas" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
            Características
          </p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Todo lo que tu consulta necesita, en un solo lugar
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Deja de saltar entre agendas, hojas de cálculo y chats. EscuchaInterna concentra tu
            práctica completa.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Reveal as="div" key={feature.title} dir="scale" delay={index * 70} className="h-full">
              <TiltCard
                max={5}
                className="group h-full rounded-card border border-line bg-bg p-6 hover:border-primary/40 hover:shadow-elev-md"
              >
                <span className="bg-eco-tile flex h-11 w-11 items-center justify-center rounded-xl text-primary transition-transform duration-300 group-hover:scale-110 group-hover:text-white">
                  <feature.icon className="h-5.5 w-5.5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.description}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
