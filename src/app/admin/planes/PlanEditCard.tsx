'use client';

import { startTransition, useActionState } from 'react';
import { Info, Star } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { LISTED_CURRENCIES } from '@/shared/domain/planPricing';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { updatePlanAction, type PlanFormState } from './actions';

const INITIAL: PlanFormState = {};

/** Datos planos de un plan para edición (vienen de listPlans() en el servidor). */
export interface EditablePlan {
  id: string;
  name: string;
  prices: Record<string, number>;
  aiMonthlyBudgetCop: number | null;
  aiSoftBudgetCop: number | null;
  /** Límite mensual de WhatsApp del plan (null = sin límite). */
  waMonthlyLimit: number | null;
  features: string[];
  highlighted: boolean;
}

export function PlanEditCard({ plan }: { plan: EditablePlan }) {
  const [state, dispatch, pending] = useActionState(updatePlanAction, INITIAL);

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          {plan.name}
          <span className="ml-2 text-xs font-normal text-ink-soft">({plan.id})</span>
        </h2>
        {plan.highlighted ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
            <Star size={11} />
            Destacado
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-ink-soft">{plan.features.join(' · ')}</p>

      {plan.id === 'organizacion' ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-bg p-3">
          <Info size={15} className="mt-0.5 shrink-0 text-primary dark:text-accent-2" />
          <p className="text-xs text-ink-soft">
            El precio público de organizaciones se calcula <strong>por asiento</strong> (tramos por
            volumen en <code>src/shared/domain/orgSeatPricing.ts</code>; el landing y el paywall
            muestran el &quot;desde&quot; de ahí). El precio COP de abajo es solo el ancla de
            referencia: <strong>editarlo aquí no cambia</strong> lo que ve el visitante. Para mover
            los tramos, edita el módulo. Simula precios en{' '}
            <a className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2" href="/admin/calculadora">
              Calculadora
            </a>
            .
          </p>
        </div>
      ) : null}

      <form
        action={dispatch}
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          submitFormWithoutNativeReset(event, () => {
            startTransition(() => dispatch(formData));
          });
        }}
        className="space-y-4"
      >
        <input type="hidden" name="plan" value={plan.id} />

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Precio de lista mensual por moneda
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LISTED_CURRENCIES.map((code) => (
              <div key={code}>
                <label
                  className="mb-1 block text-xs font-medium text-ink-soft"
                  htmlFor={`${plan.id}-precio-${code}`}
                >
                  {code}
                  {code === 'COP' ? ' (por defecto)' : ''}
                </label>
                <Input
                  id={`${plan.id}-precio-${code}`}
                  type="number"
                  name={`precio_${code}`}
                  min="0"
                  step="any"
                  defaultValue={plan.prices[code] ?? ''}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Presupuestos de IA (COP al mes)
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor={`${plan.id}-tope-duro`}>
                Tope duro (vacío = sin tope)
              </label>
              <Input
                id={`${plan.id}-tope-duro`}
                type="number"
                name="tope_duro"
                min="0"
                step="any"
                defaultValue={plan.aiMonthlyBudgetCop ?? ''}
                placeholder="Sin tope"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor={`${plan.id}-tope-suave`}>
                Umbral suave → modelo económico (vacío = nunca)
              </label>
              <Input
                id={`${plan.id}-tope-suave`}
                type="number"
                name="tope_suave"
                min="0"
                step="any"
                defaultValue={plan.aiSoftBudgetCop ?? ''}
                placeholder="Nunca degrada"
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Mensajería WhatsApp
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor={`${plan.id}-limite-wa`}>
                WhatsApp al mes (vacío = sin límite)
              </label>
              <Input
                id={`${plan.id}-limite-wa`}
                type="number"
                name="limite_wa"
                min="0"
                step="1"
                defaultValue={plan.waMonthlyLimit ?? ''}
                placeholder="Sin límite"
              />
              <p className="mt-1 text-[11px] text-ink-soft">
                Al alcanzarlo, los avisos del mes salen solo por correo.
              </p>
            </div>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-ink" htmlFor={`${plan.id}-destacado`}>
          <input
            id={`${plan.id}-destacado`}
            type="checkbox"
            name="destacado"
            defaultChecked={plan.highlighted}
            className="h-4 w-4 rounded border-line accent-primary"
          />
          Plan destacado en la landing (&quot;Más popular&quot;)
        </label>

        {state.error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>
        ) : null}
        {state.ok ? (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">{state.ok}</p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
