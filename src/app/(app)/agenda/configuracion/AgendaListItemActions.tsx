'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, Pencil, Power } from 'lucide-react';
import { activateAgendaAction, deactivateAgendaAction } from './actions';
import { BTN_DANGER, BTN_OUTLINE, Modal } from '../Modal';

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt('Copia la liga manualmente:', url);
        }
      }}
      title="Copiar liga pública"
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft transition hover:bg-bg hover:text-ink"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? 'Copiada' : 'Copiar'}
    </button>
  );
}

export function AgendaRowActions({ agendaId, active }: { agendaId: string; active: boolean }) {
  const router = useRouter();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = active
        ? await deactivateAgendaAction(agendaId)
        : await activateAgendaAction(agendaId);
      if (result && !result.ok) {
        setError(result.error ?? 'Ocurrió un error inesperado.');
        return;
      }
      setConfirmDeactivate(false);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/agenda/configuracion/${agendaId}`}
        className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
      >
        <Pencil size={13} /> Editar
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => (active ? setConfirmDeactivate(true) : toggle())}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
          active
            ? 'bg-danger-soft text-danger hover:bg-danger hover:text-white'
            : 'bg-success-soft text-success hover:bg-success hover:text-white'
        }`}
      >
        <Power size={13} /> {active ? 'Desactivar' : 'Activar'}
      </button>

      {error && !confirmDeactivate ? (
        <p className="self-center text-xs text-danger">{error}</p>
      ) : null}

      {confirmDeactivate ? (
        <Modal
          title="Desactivar agenda"
          onClose={() => {
            setConfirmDeactivate(false);
            setError(null);
          }}
        >
          <p className="text-lg font-bold text-ink">¿Estás seguro?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Los pacientes ya no podrán reservar con esta agenda desde la página pública. Las
            reservaciones existentes no se modifican.
          </p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmDeactivate(false);
                setError(null);
              }}
              className={BTN_OUTLINE}
            >
              Cancelar
            </button>
            <button type="button" disabled={pending} onClick={toggle} className={BTN_DANGER}>
              Desactivar
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
