import { ArrowUpRight, Coffee, Github } from 'lucide-react';
import { PROJECT_LINKS } from './projectLinks';

export function SupportProject() {
  return <aside className="my-6 flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-5">
    <span className="ei-icon-tile"><Coffee size={22} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Ayuda a que EscuchaInterna siga creciendo</h2><p className="mt-1 text-sm text-ink-soft">El código es abierto y el programa no requiere suscripción. Puedes apoyar a Laroc en Ko-fi o contribuir en GitHub.</p></div>
    <div className="flex flex-wrap gap-3">
      <a href={PROJECT_LINKS.repository} target="_blank" rel="noopener noreferrer" className="ei-button inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"><Github size={16} aria-hidden="true" />GitHub</a>
      <a href={PROJECT_LINKS.support} target="_blank" rel="noopener noreferrer" className="ei-button inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Coffee size={16} aria-hidden="true" />Apoyar en Ko-fi<ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
  </aside>;
}
