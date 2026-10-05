'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Send, X } from 'lucide-react';
import { Button, Select, Textarea } from '@/components/ui';
import { cancelSignatureRequestAction, requestReportSignatureAction } from '../../actions';

export interface SupervisorChoice {
  supervisorUserId: string;
  fullName: string;
  email: string;
}

/**
 * Para un practicante sin tarjeta: pedir la co-firma de su supervisor sobre un reporte
 * ya revisado. Si ya hay una solicitud pendiente, muestra el estado y permite
 * cancelarla. La identidad/organización del vínculo se valida en el servidor.
 */
export function RequestSignaturePanel({
  reportId,
  patientId,
  supervisors,
  pendingRequestId,
  canRequest,
}: {
  reportId: string;
  patientId: string;
  supervisors: SupervisorChoice[];
  pendingRequestId: string | null;
  /** El reporte está revisado (requisito para poder pedir la firma). */
  canRequest: boolean;
}) {
  const router = useRouter();
  const [supervisorUserId, setSupervisorUserId] = useState(supervisors[0]?.supervisorUserId ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await requestReportSignatureAction(reportId, patientId, supervisorUserId, note);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'No se pudo enviar la solicitud.');
    });
  }

  function cancel() {
    if (!pendingRequestId) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelSignatureRequestAction(pendingRequestId, patientId);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'No se pudo cancelar la solicitud.');
    });
  }

  if (pendingRequestId) {
    return (
      <div className="mt-3 rounded-lg border border-primary/40 dark:border-accent-2/25 bg-primary-light/30 dark:bg-primary/15 px-3 py-2 text-sm">
        <p className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Clock size={14} className="text-primary dark:text-accent-2" /> Solicitud de firma enviada
        </p>
        <p className="mt-0.5 text-ink-soft">
          Tu supervisor recibió la solicitud. Cuando firme, el reporte quedará firmado a su nombre.
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:text-danger disabled:opacity-50"
        >
          <X size={13} /> Cancelar solicitud
        </button>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  if (supervisors.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink-soft">
        No tienes un supervisor activo asignado. Pídele al perfil maestro de tu organización que te
        vincule a un supervisor para poder solicitar su firma.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
      <p className="mb-2 font-semibold text-ink">Solicitar la firma de tu supervisor</p>
      <div className="space-y-2">
        <Select
          value={supervisorUserId}
          onChange={(event) => setSupervisorUserId(event.target.value)}
          aria-label="Supervisor"
        >
          {supervisors.map((supervisor) => (
            <option key={supervisor.supervisorUserId} value={supervisor.supervisorUserId}>
              {supervisor.fullName || supervisor.email}
            </option>
          ))}
        </Select>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Nota para tu supervisor (opcional)…"
        />
      </div>
      <Button
        type="button"
        onClick={send}
        disabled={pending || !canRequest || supervisorUserId === ''}
        className="mt-2 disabled:opacity-40"
      >
        <Send size={15} /> Enviar a firmar
      </Button>
      <p className="mt-1.5 text-xs text-ink-soft">
        {canRequest
          ? 'Tu supervisor revisará el reporte y lo firmará con su tarjeta profesional.'
          : 'Primero guarda el reporte con la casilla «He revisado este contenido» marcada.'}
      </p>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
