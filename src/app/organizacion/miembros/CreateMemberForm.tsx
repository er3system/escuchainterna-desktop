'use client';

import { useActionState, useState } from 'react';
import { ClipboardCopy, KeyRound, UserPlus } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { createMemberAction, type CreateMemberState } from '../actions';
import { PermissionsFields } from './PermissionsFields';

const DEFAULT_PERMISSIONS = {
  canCharge: true,
  retentionPercent: 0,
  forceAppPayments: false,
  paymentsDisabled: false,
  canSupervisePatients: false,
  canConfigurePayments: true,
};

/**
 * Alta de cuenta de miembro: la organización cubre la suscripción (activa,
 * sin paywall) y se muestra UNA sola vez la contraseña temporal generada.
 */
export function CreateMemberForm() {
  const [state, formAction, pending] = useActionState<CreateMemberState, FormData>(
    createMemberAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {state.ok && state.temporaryPassword ? (
        <div className="rounded-card border border-success/40 bg-success-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <KeyRound size={16} /> Cuenta creada para {state.memberName} ({state.memberEmail})
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Comparte esta contraseña temporal con el miembro. Solo se muestra una vez; pídele
            cambiarla desde Configuración al entrar.
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
            <label htmlFor="nuevo-fullName" className="mb-1 block text-sm font-medium text-ink">
              Nombre completo
            </label>
            <Input
              id="nuevo-fullName"
              type="text"
              name="fullName"
              required
              placeholder="Nombre del profesional"
            />
          </div>
          <div>
            <label htmlFor="nuevo-email" className="mb-1 block text-sm font-medium text-ink">
              Correo electrónico
            </label>
            <Input
              id="nuevo-email"
              type="email"
              name="email"
              required
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="nuevo-memberRole" className="mb-1 block text-sm font-medium text-ink">
            Rol dentro de la organización
          </label>
          <Select
            id="nuevo-memberRole"
            name="memberRole"
            defaultValue="psychologist"
            className="sm:w-72"
          >
            <option value="psychologist">Psicólogo/a (consulta normal)</option>
            <option value="professor">Profesor/a (supervisión académica)</option>
          </Select>
        </div>

        <PermissionsFields defaults={DEFAULT_PERMISSIONS} idPrefix="nuevo" />

        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending}>
          <UserPlus size={16} /> {pending ? 'Creando cuenta…' : 'Crear cuenta de miembro'}
        </Button>
      </form>
    </div>
  );
}
