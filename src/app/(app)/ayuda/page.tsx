import Link from 'next/link';
import { ArrowRight, BookOpen, Check, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { tutorialsForEdition } from './tutorials';
import { readCompletedTutorials } from './helpProgress';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { DesktopQuickGuide } from '@/components/desktop/DesktopQuickGuide';

export const metadata = { title: 'Ayuda · EscuchaInterna' };

export default async function AyudaPage() {
  const userId = await requireSessionUserId();
  const desktopEdition = isDesktopEdition();
  const tutorials = tutorialsForEdition(desktopEdition);
  const completed = new Set(await readCompletedTutorials(userId));
  const doneCount = tutorials.filter((tutorial) => completed.has(tutorial.id)).length;
  const percent = Math.round((doneCount / tutorials.length) * 100);

  return (
    <div>
      <PageHeader
        title="Ayuda"
        subtitle={desktopEdition ? 'Respaldo, sincronización, lecturas y atajos para tu consulta local.' : 'Tutoriales cortos e interactivos para sacarle todo el provecho a EscuchaInterna. Avanza a tu ritmo.'}
      />

      {desktopEdition ? <><DesktopQuickGuide /><h2 className="mb-4 font-display text-xl font-bold">Tutoriales de consulta</h2></> : null}

      {/* Progreso general */}
      <div className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {doneCount === tutorials.length
              ? '¡Completaste todos los tutoriales! 🎉'
              : `${doneCount} de ${tutorials.length} tutoriales completados`}
          </p>
          <span className="text-sm font-bold text-primary dark:text-accent-2">{percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>
      </div>

      {/* Tarjetas de tutoriales */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tutorials.map((tutorial) => {
          const isDone = completed.has(tutorial.id);
          const Icon = tutorial.icon;
          return (
            <Link
              key={tutorial.id}
              href={`/ayuda/${tutorial.id}`}
              className="group flex flex-col rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Icon size={20} />
                </span>
                {isDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                    <Check size={13} /> Completado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                    <Clock size={13} /> {tutorial.minutes} min · {tutorial.steps.length} pasos
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-base font-bold text-ink">{tutorial.title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-soft">{tutorial.subtitle}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-accent-2">
                {isDone ? 'Repasar' : 'Empezar'}
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Más recursos */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-line bg-bg/40 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
          <BookOpen size={17} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink-soft">
          ¿Buscas algo más a fondo? La <span className="font-medium text-ink">Biblioteca</span> tiene guías clínicas
          y recursos para tu práctica.
        </p>
        <Link
          href="/biblioteca"
          className="shrink-0 text-sm font-medium text-primary hover:underline dark:text-accent-2"
        >
          Ir a la Biblioteca →
        </Link>
      </div>
    </div>
  );
}
