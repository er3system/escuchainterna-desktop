'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { rejectSignatureRequestAction, signRequestedReportAction } from '../../actions';

/**
 * Acciones del supervisor sobre una solicitud de co-firma: firmar con SU tarjeta o
 * rechazar con un motivo. Si el supervisor no tiene tarjeta, no puede firmar (se
 * explica en vez de ofrecer el botón).
 */
export function SignRequestActions({
  requestId,
  signerName,
  signerLicense,
}: {
  requestId: string;
  signerName: string;
  signerLicense: string;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasLicense = signerLicense.trim() !== '';

  function sign() {
    setError(null);
    startTransition(async () => {
      const result = await signRequestedReportAction(requestId);
      if (result.ok) router.push('/supervision');
      else setError(result.error ?? 'No se pudo firmar el reporte.');
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectSignatureRequestAction(requestId, reason);
      if (result.ok) router.push('/supervision');
      else setError(result.error ?? 'No se pudo rechazar la solicitud.');
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      {hasLicense ? (
        <div className="rounded-lg border border-line bg-bg px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Firmarás como</p>
          <p className="mt-0.5 font-semibold text-ink">{signerName || '—'}</p>
          <p className="text-ink-soft">Tarjeta profesional: {signerLicense}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-ink">
          <p className="font-semibold">No puedes firmar.</p>
          <p className="mt-0.5 text-ink-soft">
            Para firmar necesitas registrar tu{' '}
            <a href="/configuracion/perfil" className="font-medium text-primary dark:text-accent-2 hover:underline">
              tarjeta profesional
            </a>{' '}
            en tu perfil.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sign}
          disabled={pending || !hasLicense}
          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          <ShieldCheck size={15} /> Firmar con mi tarjeta
        </button>
        <button
          type="button"
          onClick={() => setShowReject((value) => !value)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:text-danger disabled:opacity-50"
        >
          <X size={15} /> Rechazar
        </button>
      </div>

      {showReject ? (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Motivo del rechazo (se le mostrará al practicante)…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <Button
            type="button"
            variant="danger"
            onClick={reject}
            disabled={pending}
            className="mt-2 disabled:opacity-50"
          >
            Confirmar rechazo
          </Button>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-ink-soft">
        Al firmar, el reporte queda firmado a tu nombre y se vuelve inmutable; el practicante recibe
        un aviso.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
