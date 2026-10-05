'use client';

import { startTransition, useActionState } from 'react';
import { Gift } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { ReferralProgramConfig } from '@/contexts/identity/domain/value-objects/referralProgram';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { updateReferralProgramAction, type PlanFormState } from './actions';

const INITIAL: PlanFormState = {};

/** Configuración del programa de referidos (v3 §11), editable por el admin. */
export function ReferralProgramCard({ config }: { config: ReferralProgramConfig }) {
  const [state, dispatch, pending] = useActionState(updateReferralProgramAction, INITIAL);

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Gift size={17} />
        </span>
        <div>
          <h2 className="text-base font-bold text-ink">Programa de referidos</h2>
          <p className="text-xs text-ink-soft">
            Cada referido activo descuenta el porcentaje configurado del siguiente cobro del referente.
          </p>
        </div>
      </div>

      <form
        action={dispatch}
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          submitFormWithoutNativeReset(event, () => {
            startTransition(() => dispatch(formData));
          });
        }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="ref-descuento">
            Descuento por referido (%)
          </label>
          <Input
            id="ref-descuento"
            name="descuento"
            type="number"
            min={0}
            max={100}
            defaultValue={config.descuentoPorcentaje}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="ref-max">
            Descuento máximo (%)
          </label>
          <Input
            id="ref-max"
            name="max_porcentaje"
            type="number"
            min={0}
            max={100}
            defaultValue={config.maxPorcentaje}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="ref-meses">
            Meses máximos del beneficio
          </label>
          <Input
            id="ref-meses"
            name="max_meses"
            type="number"
            min={1}
            max={60}
            defaultValue={config.maxMeses}
            required
          />
        </div>

        <div className="sm:col-span-3">
          {state.error ? <p className="mb-2 text-sm text-danger">{state.error}</p> : null}
          {state.ok ? <p className="mb-2 text-sm text-success">{state.ok}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar programa'}
          </Button>
        </div>
      </form>
    </div>
  );
}
