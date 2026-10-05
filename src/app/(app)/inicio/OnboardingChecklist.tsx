import Link from 'next/link';
import { ArrowRight, Check, Rocket, X } from 'lucide-react';
import { dismissOnboardingAction } from './actions';
import type { OnboardingState } from './onboarding';

/**
 * Tarjeta "Primeros pasos" del inicio: una guía de onboarding cuyos pasos se
 * marcan solos al cumplirse (perfil, agenda, paciente, sesión, tutorial). Se
 * oculta sola al completarse todo, o con el botón "ocultar".
 */
export function OnboardingChecklist({ state, compact = false }: { state: OnboardingState; compact?: boolean }) {
  const { steps, doneCount, total } = state;
  const percent = Math.round((doneCount / total) * 100);

  if (compact) return <section className="mb-6 flex items-start gap-3 rounded-card border border-line bg-surface p-4">
    <details className="min-w-0 flex-1">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Primeros pasos · {doneCount} de {total} listos<span className="mt-1 block text-xs font-normal text-ink-soft">Abre la guía cuando quieras completar tu consulta.</span></summary>
      <ul className="mt-4 space-y-3">{steps.filter(step => !step.done).map(step => <li key={step.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><span><span className="block text-sm font-medium">{step.label}</span><span className="block text-xs text-ink-soft">{step.hint}</span></span><Link href={step.href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong">{step.cta}<ArrowRight size={13} /></Link></li>)}</ul>
    </details>
    <form action={dismissOnboardingAction}><button type="submit" aria-label="Ocultar primeros pasos" className="rounded-lg p-1.5 text-ink-soft hover:bg-bg"><X size={16} /></button></form>
  </section>;

  return (
    <div className="mb-6 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/30 dark:bg-primary/15 p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Rocket size={18} />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink">Primeros pasos</h2>
            <p className="text-sm text-ink-soft">
              Deja tu cuenta lista en unos minutos · {doneCount} de {total} listos
            </p>
          </div>
        </div>
        <form action={dismissOnboardingAction}>
          <button
            type="submit"
            title="Ocultar"
            aria-label="Ocultar primeros pasos"
            className="rounded-lg p-1.5 text-ink-soft transition hover:bg-bg hover:text-ink"
          >
            <X size={16} />
          </button>
        </form>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done ? 'bg-success-soft text-success' : 'bg-bg text-ink-soft'
              }`}
            >
              {step.done ? <Check size={15} /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-medium ${
                  step.done ? 'text-ink-soft line-through' : 'text-ink'
                }`}
              >
                {step.label}
              </span>
              {!step.done ? <span className="block text-xs text-ink-soft">{step.hint}</span> : null}
            </span>
            {!step.done ? (
              <Link
                href={step.href}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
              >
                {step.cta} <ArrowRight size={13} />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
