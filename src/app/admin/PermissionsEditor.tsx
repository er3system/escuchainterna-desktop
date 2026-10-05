'use client';

// Tipos puros replicados (el client component no importa valores de identity).
export interface PermissionsValue {
  canCharge: boolean;
  retentionPercent: number;
  forceAppPayments: boolean;
  paymentsDisabled: boolean;
  canSupervisePatients: boolean;
  canConfigurePayments: boolean;
}

export const DEFAULT_PERMISSIONS: PermissionsValue = {
  canCharge: true,
  retentionPercent: 0,
  forceAppPayments: false,
  paymentsDisabled: false,
  canSupervisePatients: false,
  canConfigurePayments: true,
};

interface ToggleSpec {
  key: keyof Omit<PermissionsValue, 'retentionPercent'>;
  name: string;
  label: string;
  description: string;
}

const TOGGLES: ToggleSpec[] = [
  {
    key: 'canCharge',
    name: 'can_charge',
    label: 'Puede cobrar',
    description: 'Si se desactiva, el módulo de pagos queda deshabilitado (consultas sin pago).',
  },
  {
    key: 'paymentsDisabled',
    name: 'payments_disabled',
    label: 'Pagos deshabilitados',
    description: 'Alias duro de no cobrar: oculta el módulo de pagos y los precios.',
  },
  {
    key: 'forceAppPayments',
    name: 'force_app_payments',
    label: 'Forzar pagos por la app',
    description: 'Solo se permite el modo de pago "requerido al agendar" (sin pago manual).',
  },
  {
    key: 'canSupervisePatients',
    name: 'can_supervise_patients',
    label: 'Puede supervisar',
    description: 'Este miembro puede ser supervisor de otros profesionales.',
  },
  {
    key: 'canConfigurePayments',
    name: 'can_configure_payments',
    label: 'Puede configurar pagos',
    description: 'Puede editar sus tarifas y política de pago (si no, las fija la organización).',
  },
];

/**
 * Editor amigable (checkboxes + retención %) de permisos de membresía.
 * Controlado; dentro de un <form> los inputs llevan nombres `perm_*` que
 * lee readPermissionsFromForm en el servidor.
 */
export function PermissionsEditor({
  value,
  onChange,
  prefix = 'perm_',
}: {
  value: PermissionsValue;
  onChange: (next: PermissionsValue) => void;
  prefix?: string;
}) {
  return (
    <div className="space-y-2.5">
      {TOGGLES.map((toggle) => (
        <label key={toggle.name} className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name={`${prefix}${toggle.name}`}
            checked={value[toggle.key]}
            onChange={(event) => onChange({ ...value, [toggle.key]: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#16181d]"
          />
          <span>
            <span className="block text-sm font-medium text-ink">{toggle.label}</span>
            <span className="block text-xs text-ink-soft">{toggle.description}</span>
          </span>
        </label>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <label className="text-sm font-medium text-ink" htmlFor={`${prefix}retention_percent`}>
          Porcentaje de liquidación interna (%)
        </label>
        <input
          id={`${prefix}retention_percent`}
          type="number"
          name={`${prefix}retention_percent`}
          min={0}
          max={100}
          step={1}
          value={value.retentionPercent}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange({ ...value, retentionPercent: Number.isFinite(parsed) ? parsed : 0 });
          }}
          className="w-24 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
        <span className="text-xs text-ink-soft">
          % informativo del cobro que corresponde a la organización (0 = nada).
        </span>
      </div>
    </div>
  );
}
