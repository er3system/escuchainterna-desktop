'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { PermissionsEditor, DEFAULT_PERMISSIONS, type PermissionsValue } from '../PermissionsEditor';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { upsertOrganizationAction, type OrganizationFormState } from './actions';

const INITIAL: OrganizationFormState = {};

export interface OrganizationFormValues {
  id: string;
  name: string;
  slug: string;
  kind: string;
  masterUserId: string | null;
  /** Servicio sin costo (v3 §3): consultas gratuitas para todo el equipo. */
  freeService: boolean;
  defaultPolicies: PermissionsValue;
}

export interface MasterOption {
  id: string;
  label: string;
}

const KIND_OPTIONS = [
  { value: 'empresa', label: 'Empresa' },
  { value: 'universidad', label: 'Universidad' },
  { value: 'clinica', label: 'Clínica' },
];

export function OrganizationForm({
  organization,
  masters,
}: {
  organization: OrganizationFormValues | null;
  masters: MasterOption[];
}) {
  const [state, dispatch, pending] = useActionState(upsertOrganizationAction, INITIAL);
  const [policies, setPolicies] = useState<PermissionsValue>(
    organization ? { ...organization.defaultPolicies } : { ...DEFAULT_PERMISSIONS },
  );

  return (
    <form
      action={dispatch}
      onSubmit={
        organization
          ? (event) => {
              const formData = new FormData(event.currentTarget);
              submitFormWithoutNativeReset(event, () => {
                startTransition(() => dispatch(formData));
              });
            }
          : undefined
      }
      className="space-y-4"
    >
      {organization ? <input type="hidden" name="organizacion_id" value={organization.id} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="org-nombre">
            Nombre de la organización *
          </label>
          <Input
            id="org-nombre"
            type="text"
            name="nombre"
            required
            defaultValue={organization?.name ?? ''}
            placeholder="P. ej. Universidad del Valle"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="org-slug">
            Slug *
          </label>
          <Input
            id="org-slug"
            type="text"
            name="slug"
            required
            defaultValue={organization?.slug ?? ''}
            placeholder="p-ej-universidad-valle"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Vista previa del dominio en producción: <code>&lt;slug&gt;.escuchainterna.com</code>
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="org-tipo">
            Tipo *
          </label>
          <Select id="org-tipo" name="tipo" defaultValue={organization?.kind ?? 'empresa'}>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="org-maestro">
            Perfil maestro asignado
          </label>
          <Select
            id="org-maestro"
            name="maestro"
            defaultValue={organization?.masterUserId ?? ''}
          >
            <option value="">— Sin maestro asignado —</option>
            {masters.map((master) => (
              <option key={master.id} value={master.id}>
                {master.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-soft">
            Solo aparecen cuentas con rol de maestro de organización (créalas en Cuentas).
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-bg p-4">
        <input
          type="checkbox"
          name="servicio_sin_costo"
          defaultChecked={organization?.freeService ?? false}
          className="mt-0.5 h-4 w-4 accent-[#16181d]"
        />
        <span>
          <span className="block text-sm font-medium text-ink">
            Servicio sin costo (universidades)
          </span>
          <span className="block text-xs text-ink-soft">
            Las consultas del equipo son gratuitas: pagos deshabilitados para todos los miembros,
            sin precios en las páginas públicas de reservas y el onboarding salta el paso de pago.
          </span>
        </span>
      </label>

      <div className="rounded-lg border border-line bg-bg p-4">
        <p className="mb-3 text-sm font-medium text-ink">
          Políticas por defecto para nuevos miembros
          <span className="block text-xs font-normal text-ink-soft">
            Se aplican al crear miembros sin permisos personalizados.
          </span>
        </p>
        <PermissionsEditor value={policies} onChange={setPolicies} />
      </div>

      {state.error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{state.ok}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : organization ? 'Guardar cambios' : 'Crear organización'}
      </Button>
    </form>
  );
}
