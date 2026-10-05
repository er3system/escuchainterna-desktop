'use client';

import { useActionState, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteOwnAccountAction, type DeleteAccountState } from './deleteAccountActions';

const INITIAL: DeleteAccountState = {};

export function DeleteAccountPanel() {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(deleteOwnAccountAction, INITIAL);

  return (
    <div className="rounded-2xl border border-danger/40 bg-danger-soft/30 p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-danger">
        <AlertTriangle size={14} /> Eliminar mi cuenta
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Borra definitivamente tu cuenta y todos tus datos. Es tu derecho de cancelación (Ley 1581) y
        no se puede deshacer. Si conservas datos clínicos bajo retención legal, primero deberás
        exportarlos o transferir su custodia.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-danger/50 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
        >
          <Trash2 size={15} /> Quiero eliminar mi cuenta
        </button>
      ) : (
        <form action={dispatch} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="del-password">
              Tu contraseña
            </label>
            <input
              id="del-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="del-confirm">
              Escribe <span className="font-bold">ELIMINAR MI CUENTA</span> para confirmar
            </label>
            <input
              id="del-confirm"
              name="confirmacion"
              type="text"
              autoComplete="off"
              required
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          {state.error ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:opacity-60"
            >
              <Trash2 size={15} /> {pending ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-bg"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
