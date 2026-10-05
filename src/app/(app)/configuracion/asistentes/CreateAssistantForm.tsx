'use client';

import { useActionState, useState } from 'react';
import { ClipboardCopy, KeyRound, UserPlus } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { createAssistantAction, type CreateAssistantState } from './actions';

/**
 * Alta de cuenta de asistente/recepcionista: la suscripción queda cubierta por
 * el titular y la contraseña temporal generada se muestra UNA sola vez.
 */
export function CreateAssistantForm() {
  const [state, formAction, pending] = useActionState<CreateAssistantState, FormData>(
    createAssistantAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {state.ok && state.temporaryPassword ? (
        <div className="rounded-card border border-success/40 bg-success-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <KeyRound size={16} /> Cuenta creada para {state.assistantName} ({state.assistantEmail})
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Comparte esta contraseña temporal con tu asistente. Solo se muestra una vez; pídele
            cambiarla al entrar.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-sm font-semibold text-ink">
              {state.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.temporaryPassword ?? '');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
            >
              <ClipboardCopy size={14} /> {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="asistente-fullName" className="mb-1 block text-sm font-medium text-ink">
              Nombre completo
            </label>
            <Input
              id="asistente-fullName"
              type="text"
              name="fullName"
              required
              placeholder="Nombre de tu asistente"
            />
          </div>
          <div>
            <label htmlFor="asistente-email" className="mb-1 block text-sm font-medium text-ink">
              Correo electrónico
            </label>
            <Input
              id="asistente-email"
              type="email"
              name="email"
              required
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending}>
          <UserPlus size={16} /> {pending ? 'Creando cuenta…' : 'Crear cuenta de asistente'}
        </Button>
      </form>
    </div>
  );
}
