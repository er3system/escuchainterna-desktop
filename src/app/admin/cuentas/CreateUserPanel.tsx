'use client';

import { useActionState, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, KeyRound, UserPlus } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { PermissionsEditor, DEFAULT_PERMISSIONS, type PermissionsValue } from '../PermissionsEditor';
import { createUserAction, type CreateUserState } from './actions';

const INITIAL: CreateUserState = {};

// Réplica local de los roles (módulo puro, sin imports de identity).
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'psychologist', label: 'Psicólogo/a' },
  { value: 'org_master', label: 'Perfil maestro de organización' },
  { value: 'professor', label: 'Supervisión académica (professor)' },
  { value: 'admin', label: 'Administración de la plataforma' },
];

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface PresetOption {
  name: string;
  permissions: PermissionsValue;
}

export function CreateUserPanel({
  organizations,
  presets,
}: {
  organizations: OrganizationOption[];
  presets: PresetOption[];
}) {
  const [state, dispatch, pending] = useActionState(createUserAction, INITIAL);
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [customize, setCustomize] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsValue>(DEFAULT_PERMISSIONS);

  // Crear una cuenta es un alta, por lo que aquí sí queremos limpiar el form.
  // React resetea los campos nativos; estos estados controlados deben acompañarlo.
  useEffect(() => {
    if (!state.ok) return;
    setOrganizationId('');
    setCustomize(false);
    setPermissions({ ...DEFAULT_PERMISSIONS });
  }, [state]);

  return (
    <div className="mb-6 rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <UserPlus size={17} className="text-primary" />
          Crear usuario
        </span>
        {open ? <ChevronUp size={17} className="text-ink-soft" /> : <ChevronDown size={17} className="text-ink-soft" />}
      </button>

      {open ? (
        <form action={dispatch} className="space-y-4 border-t border-line px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-nombre">
                Nombre completo *
              </label>
              <Input id="crear-nombre" type="text" name="nombre" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-email">
                Correo electrónico *
              </label>
              <Input id="crear-email" type="email" name="email" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-rol">
                Rol de plataforma *
              </label>
              <Select id="crear-rol" name="rol" defaultValue="psychologist">
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-password">
                Contraseña inicial
              </label>
              <Input
                id="crear-password"
                type="text"
                name="password"
                minLength={6}
                placeholder="Vacía = se genera una temporal"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-organizacion">
                Organización (opcional)
              </label>
              <Select
                id="crear-organizacion"
                name="organizacion"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                <option value="">Sin organización (profesional individual)</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {organizationId ? (
            <div className="rounded-lg border border-line bg-bg p-4">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  name="personalizar_permisos"
                  checked={customize}
                  onChange={(event) => setCustomize(event.target.checked)}
                  className="h-4 w-4 accent-[#16181d]"
                />
                <span className="text-sm font-medium text-ink">
                  Personalizar permisos de membresía
                  <span className="block text-xs font-normal text-ink-soft">
                    Si no se personalizan, se aplican las políticas por defecto de la organización.
                  </span>
                </span>
              </label>

              {customize ? (
                <div className="mt-3 space-y-3">
                  {presets.length > 0 ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="crear-preset">
                        Partir de una plantilla de permisos
                      </label>
                      <Select
                        id="crear-preset"
                        defaultValue=""
                        onChange={(event) => {
                          const preset = presets.find((item) => item.name === event.target.value);
                          if (preset) setPermissions({ ...preset.permissions });
                        }}
                      >
                        <option value="">— Elegir plantilla —</option>
                        {presets.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                  <PermissionsEditor value={permissions} onChange={setPermissions} />
                </div>
              ) : null}
            </div>
          ) : null}

          {state.error ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          {state.ok ? (
            <div className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              <p>{state.ok}</p>
              {state.temporaryPassword ? (
                <p className="mt-1 flex items-center gap-1.5 font-medium">
                  <KeyRound size={14} />
                  Contraseña temporal: <code className="rounded bg-white/70 px-1.5 py-0.5">{state.temporaryPassword}</code>
                </p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
