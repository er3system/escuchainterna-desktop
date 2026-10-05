import Link from 'next/link';
import { ArrowRight, BookOpen, Brain, Scale, type LucideIcon } from 'lucide-react';

interface ResourceCategory {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CATEGORIES: ResourceCategory[] = [
  {
    icon: Brain,
    title: 'Modelos terapéuticos',
    description:
      'Guías claras sobre enfoques como TCC, sistémico, humanista o psicodinámico, redactadas para la práctica.',
  },
  {
    icon: BookOpen,
    title: 'Temas clínicos',
    description:
      'Publicaciones sobre evaluación, intervención en crisis, adherencia terapéutica y más, con fuentes citadas.',
  },
  {
    icon: Scale,
    title: 'Marcos normativos',
    description:
      'Lo esencial de la regulación de la práctica psicológica y la protección de datos, filtrable por país.',
  },
];

export function Resources() {
  return (
    <section id="recursos" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">Recursos</p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Biblioteca EscuchaInterna: conocimiento listo para tu consulta
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Una colección de publicaciones propias, con fuentes públicas y abiertas, que crece cada
            mes — incluida en tu suscripción.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CATEGORIES.map((category) => (
            <div
              key={category.title}
              className="rounded-card border border-line bg-surface p-7 shadow-card"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                <category.icon className="h-5.5 w-5.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{category.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{category.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary dark:text-accent-2 transition-colors hover:text-primary-dark dark:hover:text-accent-2"
          >
            Explora la biblioteca con tu prueba gratis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
