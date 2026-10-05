'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X } from 'lucide-react';
import { shareReadOnlyAction, revokeShareAction } from './actions';

export interface ShareColleague {
  userId: string;
  name: string;
  email: string;
}

export interface ShareGrant {
  id: string;
  granteeName: string;
  granteeEmail: string;
}

export function SharePatient({
  patientId,
  colleagues,
  shares,
}: {
  patientId: string;
  colleagues: ShareColleague[];
  shares: ShareGrant[];
}) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Colegas que aún no tienen una concesión viva (para no ofrecer duplicados).
  const sharedIds = new Set(shares.map((s) => s.granteeEmail));
  const available = colleagues.filter((c) => !sharedIds.has(c.email));

  function share() {
    if (!selected) return;
    startTransition(async () => {
      const res = await shareReadOnlyAction(patientId, selected);
      if (res.ok) {
        setSelected('');
        setError(null);
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo compartir.');
      }
    });
  }

  function revoke(shareId: string) {
    startTransition(async () => {
      const res = await revokeShareAction(patientId, shareId);
      if (res.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo revocar.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {shares.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {shares.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{s.granteeName}</p>
                <p className="truncate text-xs text-ink-soft">{s.granteeEmail} · solo lectura</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => revoke(s.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-danger disabled:opacity-50"
              >
                <X size={14} />
                Revocar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Todavía no compartes este expediente con nadie.</p>
      )}

      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            <option value="">Elige un colega…</option>
            {available.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selected}
            onClick={share}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <UserPlus size={16} />
            Compartir
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          {colleagues.length === 0
            ? 'No hay otros colegas en tu organización con quienes compartir.'
            : 'Ya compartiste con todos los colegas disponibles.'}
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
