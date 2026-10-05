import Link from 'next/link';
import { ChevronDown, FileDown, Globe, Lock, ShieldCheck, type LucideIcon } from 'lucide-react';
import { PRIVACY_COUNTRY_LAWS } from '@/shared/domain/privacyCountryLaws';

interface PrivacyPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

const PRIVACY_POINTS: PrivacyPoint[] = [
  {
    icon: Lock,
    title: 'Cifrado en tránsito y en reposo',
    description:
      'Toda la comunicación viaja cifrada mediante HTTPS/TLS, y la información clínica sensible se guarda además cifrada dentro de la base de datos (AES-256).',
  },
  {
    icon: ShieldCheck,
    title: 'Datos aislados por profesional',
    description:
      'Cada cuenta solo puede acceder a sus propios pacientes. El aislamiento es estructural: se aplica en cada consulta a la base de datos, por diseño.',
  },
  {
    icon: Globe,
    title: 'Diseñado según la ley de tu país',
    description:
      'Construimos la plataforma tomando como referencia la Ley 1581 de Habeas Data (Colombia), la LFPDPPP (México) y otras normas de protección de datos de la región, para ayudarte a cumplir tus obligaciones como responsable de la información de tus pacientes.',
  },
  {
    icon: FileDown,
    title: 'El paciente es tuyo, no nuestro',
    description:
      'La información clínica pertenece al profesional. Exporta tus expedientes y datos cuando quieras; nunca los usamos con fines propios.',
  },
];

export function Privacy() {
  return (
    <section id="privacidad" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
            Privacidad y seguridad
          </p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tu información clínica, protegida
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Trabajas con lo más sensible que existe: la vida interior de tus pacientes. Lo tratamos
            con la seriedad que merece.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRIVACY_POINTS.map((point) => (
            <div key={point.title} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                <point.icon className="h-5.5 w-5.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{point.description}</p>
            </div>
          ))}
        </div>

        {/* ---- Cumplimiento por país (v3 §8, Colombia primero) ---- */}
        <div className="mx-auto mt-14 max-w-3xl">
          <h3 className="text-center text-xl font-bold tracking-tight text-ink">
            Las leyes de tu país, por su nombre
          </h3>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Nada de promesas genéricas: estas son las normas concretas que tomamos como referencia
            según el país donde ejerces.
          </p>
          <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {PRIVACY_COUNTRY_LAWS.map((entry, index) => (
              <details key={entry.country} open={index === 0} className="group border-b border-line last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 transition-colors hover:bg-bg dark:hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="text-lg">
                    {entry.flag}
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">{entry.country}</span>
                  <span className="hidden text-xs text-ink-soft sm:block">
                    {entry.laws.map((law) => law.name.split('—')[0].trim()).join(' · ')}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-soft transition-transform group-open:rotate-180"
                  />
                </summary>
                <ul className="space-y-3 border-t border-line bg-bg/60 px-5 py-4">
                  {entry.laws.map((law) => (
                    <li key={law.name} className="text-sm leading-relaxed text-ink-soft">
                      <span className="font-semibold text-ink">{law.name}.</span> {law.scope}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-ink-soft">
          Lee los detalles completos en nuestro{' '}
          <Link href="/legal/privacidad" className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2">
            Aviso de privacidad
          </Link>{' '}
          y los{' '}
          <Link href="/legal/terminos" className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2">
            Términos y condiciones
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
