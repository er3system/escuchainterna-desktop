'use client';

import { useActionState, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { sendOrgNoticeAction, type OrgNoticeFormState } from './actions';

const INITIAL: OrgNoticeFormState = {};

export interface NoticeRecipientOption {
  userId: string;
  name: string;
  detail: string;
}

/** Formulario de aviso (v3 §12): a todos o a destinatarios seleccionados. */
export function OrgNoticeForm({ recipients }: { recipients: NoticeRecipientOption[] }) {
  const [state, dispatch, pending] = useActionState(sendOrgNoticeAction, INITIAL);
  const [toAll, setToAll] = useState(true);

  // El envío exitoso limpia los campos nativos; vuelve también la audiencia
  // controlada a su valor inicial para evitar un DOM y un estado divergentes.
  useEffect(() => {
    if (state.ok) setToAll(true);
  }, [state]);

  return (
    <form action={dispatch} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="aviso-titulo">
          Título *
        </label>
        <Input
          id="aviso-titulo"
          name="titulo"
          type="text"
          required
          placeholder="P. ej. Fecha de corte de expedientes: 30 de junio"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="aviso-cuerpo">
          Mensaje
        </label>
        <Textarea
          id="aviso-cuerpo"
          name="cuerpo"
          rows={4}
          placeholder="Detalle del aviso: entregas, fechas de corte, indicaciones…"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="todos"
          checked={toAll}
          onChange={(event) => setToAll(event.target.checked)}
          className="accent-primary"
        />
        Enviar a {recipients.length === 1 ? 'la única persona disponible' : `todas (${recipients.length})`}
      </label>

      {!toAll ? (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-bg p-3">
          {recipients.map((recipient) => (
            <label key={recipient.userId} className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="destinatarios"
                value={recipient.userId}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{recipient.name}</span>
                <span className="block truncate text-xs text-ink-soft">{recipient.detail}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">{state.ok}</p> : null}

      <Button type="submit" disabled={pending || recipients.length === 0}>
        <Send size={15} /> {pending ? 'Enviando…' : 'Enviar aviso'}
      </Button>
    </form>
  );
}
