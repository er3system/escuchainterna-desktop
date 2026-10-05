'use client';

import { useState, useTransition } from 'react';
import { BadgeCheck, Stamp } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { setPublicationReviewedAction } from './actions';

export interface ModerationRow {
  id: string;
  title: string;
  category: string;
  country: string;
  reviewed: boolean;
}

export function ModerationTable({ publications }: { publications: ModerationRow[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, reviewed: boolean) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await setPublicationReviewedAction(id, reviewed);
      setBusyId(null);
      if (result.error) setError(result.error);
    });
  }

  if (publications.length === 0) {
    return (
      <EmptyState
        title="Nada por aquí"
        description="No hay publicaciones que coincidan con este filtro."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {error ? (
        <p className="border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger">{error}</p>
      ) : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-3 font-medium">Publicación</th>
            <th className="px-3 py-3 font-medium">Categoría</th>
            <th className="px-3 py-3 font-medium">País</th>
            <th className="px-3 py-3 font-medium">Estado</th>
            <th className="px-3 py-3 text-right font-medium">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {publications.map((pub) => (
            <tr key={pub.id} className="hover:bg-bg/60">
              <td className="px-5 py-3 font-medium text-ink">{pub.title}</td>
              <td className="px-3 py-3 text-ink-soft">{pub.category}</td>
              <td className="px-3 py-3 text-ink-soft">{pub.country || '—'}</td>
              <td className="px-3 py-3">
                {pub.reviewed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                    <BadgeCheck size={12} />
                    Revisada
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                    Por revisar
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  disabled={pending && busyId === pub.id}
                  onClick={() => toggle(pub.id, !pub.reviewed)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    pub.reviewed
                      ? 'border-line text-ink-soft hover:bg-bg'
                      : 'border-primary/40 text-primary hover:bg-primary-light'
                  }`}
                >
                  <Stamp size={13} />
                  {pub.reviewed ? 'Quitar sello' : 'Marcar revisada'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
