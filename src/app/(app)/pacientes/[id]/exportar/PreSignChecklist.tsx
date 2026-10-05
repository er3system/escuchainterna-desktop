import { CheckCircle2, ListChecks } from 'lucide-react';

/**
 * Checklist "Antes de firmar": los huecos del expediente (lo que no consta) se
 * muestran como recordatorio de PANTALLA, nunca dentro del PDF firmable
 * (`print:hidden`). Componente presentacional puro (sirve en server y client).
 */
export function PreSignChecklist({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm text-ink print:hidden">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
        <span>
          No se detectaron huecos estructurales en el expediente. Verifica de todos modos el contenido
          clínico antes de firmar.
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-warning/40 bg-warning-soft px-4 py-3 print:hidden">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ListChecks size={16} className="text-warning" /> Antes de firmar — puntos a revisar
      </p>
      <p className="mb-2 mt-0.5 text-xs text-ink-soft">
        Recordatorios de pantalla: NO se imprimen en el documento. El reporte solo debe afirmar lo que
        esté registrado.
      </p>
      <ul className="space-y-1 text-sm text-ink">
        {gaps.map((gap, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
            {gap}
          </li>
        ))}
      </ul>
    </div>
  );
}
