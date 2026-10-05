'use client';

import type { MembershipPermissionsPrimitives } from '@/contexts/identity/domain/value-objects/MembershipPermissions';

interface PermissionOption {
  name: string;
  label: string;
  description: string;
  key: keyof MembershipPermissionsPrimitives;
}

const PERMISSION_OPTIONS: PermissionOption[] = [
  {
    name: 'canCharge',
    key: 'canCharge',
    label: 'Puede cobrar',
    description: 'Si se desmarca, sus consultas se crean sin pago.',
  },
  {
    name: 'paymentsDisabled',
    key: 'paymentsDisabled',
    label: 'Deshabilitar módulo de pagos',
    description: 'Oculta /pagos y los precios en todo su flujo (manda sobre "puede cobrar").',
  },
  {
    name: 'forceAppPayments',
    key: 'forceAppPayments',
    label: 'Forzar pago al agendar',
    description: 'Solo modo "pago requerido al agendar"; sin registro de pago manual.',
  },
  {
    name: 'canSupervisePatients',
    key: 'canSupervisePatients',
    label: 'Puede supervisar pacientes',
    description: 'Habilita asignarle supervisados (vista de solo lectura).',
  },
  {
    name: 'canConfigurePayments',
    key: 'canConfigurePayments',
    label: 'Puede configurar sus tarifas',
    description: 'Si se desmarca, las tarifas y la política de pago las fija la organización.',
  },
];

/**
 * Campos de permisos de membresía compartidos por el alta de miembros y el
 * editor por miembro. Los names coinciden con lo que leen las server actions.
 */
export function PermissionsFields({
  defaults,
  idPrefix,
}: {
  defaults: MembershipPermissionsPrimitives;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Permisos del miembro
      </legend>
      {PERMISSION_OPTIONS.map((option) => (
        <label key={option.name} htmlFor={`${idPrefix}-${option.name}`} className="flex items-start gap-2.5">
          <input
            id={`${idPrefix}-${option.name}`}
            type="checkbox"
            name={option.name}
            defaultChecked={Boolean(defaults[option.key])}
            className="mt-0.5 h-4 w-4 rounded border-line text-primary accent-[#16181d] focus:ring-primary"
          />
          <span>
            <span className="block text-sm font-medium text-ink">{option.label}</span>
            <span className="block text-xs text-ink-soft">{option.description}</span>
          </span>
        </label>
      ))}
      <label htmlFor={`${idPrefix}-retentionPercent`} className="flex items-center gap-3 pt-1">
        <span className="text-sm font-medium text-ink">Porcentaje de liquidación interna</span>
        <span className="inline-flex items-center gap-1">
          <input
            id={`${idPrefix}-retentionPercent`}
            type="number"
            name="retentionPercent"
            min={0}
            max={100}
            step={1}
            defaultValue={defaults.retentionPercent}
            className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <span className="text-sm text-ink-soft">%</span>
        </span>
        <span className="text-xs text-ink-soft">informativo, de cada cobro (0 = nada)</span>
      </label>
    </fieldset>
  );
}
