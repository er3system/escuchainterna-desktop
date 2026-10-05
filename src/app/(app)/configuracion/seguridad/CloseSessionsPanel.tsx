'use client';

import { useActionState } from 'react';
import { LogOut } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { closeOtherSessionsAction, type CloseSessionsState } from './actions';

const INITIAL: CloseSessionsState = {};

export function CloseSessionsPanel() {
  const [state, dispatch, pending] = useActionState(closeOtherSessionsAction, INITIAL);

  return (
    <Card>
      <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
        <LogOut size={14} /> Sesiones activas
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Si crees que dejaste tu sesión abierta en otro dispositivo, ciérralas todas. Este
        dispositivo seguirá conectado; los demás tendrán que volver a iniciar sesión.
      </p>
      {state.ok ? (
        <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          Listo: se cerraron tus otras sesiones.
        </p>
      ) : null}
      <form action={dispatch} className="mt-3">
        <Button type="submit" variant="outline" disabled={pending}>
          <LogOut size={15} /> {pending ? 'Cerrando…' : 'Cerrar todas mis otras sesiones'}
        </Button>
      </form>
    </Card>
  );
}
