import Link from 'next/link';
import { ArrowRight, FolderHeart, Gift, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Eyebrow } from './Eyebrow';
import { EchoRings } from './Echo';

interface Capability {
  icon: LucideIcon;
  label: string;
  note: string;
}

/**
 * Fila de 4 CAPACIDADES reales (sustituye a las métricas estimadas −85%/+18h/×3, que
 * eran cifras inventadas). Cada una es verificable en el código del producto, así que
 * dice la verdad sin prometer resultados. Va dentro de un <Panel tone="ink">.
 */
const CAPABILITIES: Capability[] = [
  {
    icon: FolderHeart,
    label: 'Expediente + CIE-11',
    note: 'Historia, sesiones, diagnóstico y cuestionarios en un solo lugar.',
  },
  {
    icon: ShieldCheck,
    label: 'Cifrado AES-256',
    note: 'El contenido clínico se guarda cifrado en reposo. Tus datos son tuyos.',
  },
  {
    icon: Scale,
    label: 'Privacidad y habeas data',
    note: 'Derechos sobre tus datos y aviso de privacidad conforme a la Ley 1581 (Colombia) y con referentes de Latinoamérica.',
  },
  {
    icon: Gift,
    label: '7 días gratis',
    note: 'Prueba todo sin tarjeta de crédito. Cancela cuando quieras.',
  },
];

export function StatRow() {
  return (
    <div className="relative px-6 py-16 sm:px-10 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Eyebrow tone="light" glyph>
          Lo que te llevas
        </Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          No son promesas: son capacidades reales, desde el primer día.
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.label}
              data-stat
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20"
            >
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/25 text-primary-light">
                <EchoRings className="text-white/10" size="5rem" count={3} />
                <cap.icon className="relative h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-bold text-white">{cap.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-panel-ink-soft">{cap.note}</p>
            </div>
          ))}
        </div>

        {/* Barra-CTA lavanda al pie (el reel cierra el panel oscuro con una). */}
        <Link
          href="/registro"
          className="group sheen mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:bg-primary-dark"
        >
          Crea tu consulta — 7 días gratis
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
