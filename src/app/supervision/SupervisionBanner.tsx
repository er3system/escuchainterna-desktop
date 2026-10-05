import { Eye } from 'lucide-react';

/** Banner ámbar fijo de la vista de supervisión: aquí nada se edita. */
export function SupervisionBanner({ detail }: { detail?: string }) {
  return (
    <div className="mb-6 flex items-center gap-2.5 rounded-card border border-warning/40 bg-warning-soft px-4 py-3">
      <Eye size={18} className="shrink-0 text-warning" />
      <p className="text-sm font-semibold text-warning">
        Vista de supervisión — solo lectura
        {detail ? <span className="font-normal"> · {detail}</span> : null}
      </p>
    </div>
  );
}
