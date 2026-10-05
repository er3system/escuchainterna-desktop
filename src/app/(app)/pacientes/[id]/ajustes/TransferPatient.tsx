'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { transferPatientAction } from './actions';
import type { ShareColleague } from './SharePatient';

export function TransferPatient({
  patientId,
  colleagues,
}: {
  patientId: string;
  colleagues: ShareColleague[];
}) {
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const target = colleagues.find((c) => c.userId === selected) ?? null;

  function doTransfer() {
    if (!selected) return;
    startTransition(async () => {
      const res = await transferPatientAction(patientId, selected);
      if (res.ok) {
        router.push('/pacientes');
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo transferir.');
        setConfirming(false);
      }
    });
  }

  if (colleagues.length === 0) {
    return (
      <p className="text-xs text-ink-soft">
        No hay otros colegas en tu organización a quienes transferir este paciente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}
            disabled={pending}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            <option value="">Elige un colega…</option>
            {colleagues.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected}
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-warning/50 px-4 py-2 text-sm font-semibold text-warning transition-colors hover:bg-warning-soft disabled:opacity-50"
          >
            <ArrowRightLeft size={16} />
            Transferir
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/40 bg-warning-soft p-4">
          <p className="flex items-start gap-2 text-sm text-ink">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <span>
              Vas a ceder este paciente y <strong>todo su expediente</strong> a{' '}
              <strong>{target?.name}</strong>. Dejarás de tener acceso (solo el colega podría
              devolvértelo). ¿Confirmas?
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={doTransfer}
              className="rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
            >
              {pending ? 'Transfiriendo…' : `Sí, transferir a ${target?.name?.split(' ')[0] ?? 'el colega'}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
