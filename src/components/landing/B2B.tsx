import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  Palette,
  Percent,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface B2BFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const B2B_FEATURES: B2BFeature[] = [
  {
    icon: Users,
    title: 'Perfiles maestros',
    description:
      'Administra a todo tu equipo desde una cuenta de organización: altas, permisos y políticas por miembro.',
  },
  {
    icon: GraduationCap,
    title: 'Supervisión de practicantes',
    description:
      'Profesores y supervisores revisan notas e historias clínicas de sus practicantes en modo solo lectura.',
  },
  {
    icon: Percent,
    title: 'Retención por cobro',
    description:
      'Define el porcentaje que tu organización retiene de cada honorario, con desglose transparente para el profesional.',
  },
  {
    icon: Palette,
    title: 'Branding propio',
    description:
      'Tu logo en la app de tu equipo, en los correos y en la página pública de reservas, con tu propio subdominio.',
  },
];

export function B2B() {
  return (
    <section className="py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-light">
              Organizaciones
            </p>
            <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Para clínicas y equipos de formación
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Centros de atención psicológica, clínicas privadas y equipos que forman practicantes
              pueden usar EscuchaInterna para coordinar equipos completos: cada profesional con su
              consulta aislada, y la organización con visibilidad agregada — nunca del contenido
              clínico.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Pruébala gratis como profesional — 7 días
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="mailto:hola@escuchainterna.com?subject=Demostraci%C3%B3n%20para%20organizaciones"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60"
              >
                Agenda una demostración
              </a>
            </div>
            <p className="mt-5 text-sm text-white/70">
              ¿Cuánto cuesta para tu equipo?{' '}
              <a
                href="#precio-equipo"
                className="inline-flex items-center gap-1 font-semibold text-primary-light underline-offset-4 hover:underline"
              >
                Calcula tu precio
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {B2B_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-card border border-white/10 bg-white/5 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/25 text-primary-light">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
