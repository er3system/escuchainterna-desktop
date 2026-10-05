'use client';

import { useActionState, useState } from 'react';
import { ChevronDown, Unplug } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { REDACTED_INTEGRATION_SECRET } from '@/contexts/practitioner/domain/integrationCredentials';
import {
  disconnectIntegrationAction,
  saveIntegrationAction,
  type IntegracionFormState,
} from './actions';

export interface IntegrationFieldSpec {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
}

const INITIAL: IntegracionFormState = {};
type IntegrationFormAction = 'save' | 'disconnect';

export function IntegrationForm({
  provider,
  fields,
  currentConfig,
  connected,
  configurationRevision,
}: {
  provider: string;
  fields: IntegrationFieldSpec[];
  currentConfig: Record<string, string>;
  connected: boolean;
  configurationRevision: string;
}) {
  const [open, setOpen] = useState(false);
  const [saveState, saveDispatch, savePending] = useActionState(saveIntegrationAction, INITIAL);
  const [disconnectState, disconnectDispatch, disconnectPending] = useActionState(
    disconnectIntegrationAction,
    INITIAL,
  );
  const [lastAction, setLastAction] = useState<IntegrationFormAction>('save');

  const activeState = lastAction === 'disconnect' ? disconnectState : saveState;
  const feedback = activeState.error ?? activeState.ok;
  const isError = Boolean(activeState.error);

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="soft" size="sm" onClick={() => setOpen(!open)}>
          {connected ? 'Editar credenciales' : 'Conectar'}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
        {connected ? (
          <form action={disconnectDispatch} onSubmit={() => setLastAction('disconnect')}>
            <input type="hidden" name="provider" value={provider} />
            <button
              type="submit"
              disabled={disconnectPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
            >
              <Unplug size={13} /> {disconnectPending ? 'Desconectando…' : 'Desconectar'}
            </button>
          </form>
        ) : null}
      </div>

      {open ? (
        <form
          key={configurationRevision}
          action={saveDispatch}
          onSubmit={() => setLastAction('save')}
          className="mt-3 max-w-lg space-y-3"
        >
          <input type="hidden" name="provider" value={provider} />
          {fields.map((field) => {
            const secretStored = currentConfig[field.key] === REDACTED_INTEGRATION_SECRET;
            return (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-semibold text-ink" htmlFor={`${provider}-${field.key}`}>
                {field.label}:
              </label>
              <Input
                id={`${provider}-${field.key}`}
                name={`config_${field.key}`}
                type={field.type}
                defaultValue={secretStored ? '' : (currentConfig[field.key] ?? '')}
                placeholder={secretStored ? 'Credencial guardada; escribe para reemplazarla' : field.placeholder}
                autoComplete="off"
              />
            </div>
            );
          })}
          <p className="text-xs text-ink-soft">
            Los secretos se guardan cifrados y no vuelven a enviarse al navegador. Deja un secreto vacío para
            conservarlo; usa «Desconectar» para borrarlo.
          </p>
          <Button type="submit" disabled={savePending || disconnectPending}>
            {savePending ? 'Guardando…' : 'Guardar credenciales'}
          </Button>
        </form>
      ) : null}

      {feedback ? (
        <p className={`mt-2 text-xs ${isError ? 'text-danger' : 'text-success'}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
