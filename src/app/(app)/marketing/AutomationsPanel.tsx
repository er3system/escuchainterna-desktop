'use client';

import { startTransition, useActionState, useState } from 'react';
import { Cake, HeartHandshake, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { MarketingAutomationPrimitives } from '@/contexts/marketing/domain/MarketingAutomation';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { updateAutomationAction, type MarketingActionState } from './actions';

const INITIAL: MarketingActionState = {};

const KIND_META = {
  cumpleanios: {
    title: 'Felicitación de cumpleaños',
    description: 'Se envía un correo automático el día del cumpleaños de cada paciente (una vez por año).',
    icon: Cake,
    panel: 'bg-warning-soft',
    tint: 'text-warning',
  },
  reactivacion: {
    title: 'Reactivación de pacientes',
    description: 'Invita a retomar sesiones a pacientes cuya última sesión fue hace más del intervalo configurado.',
    icon: HeartHandshake,
    panel: 'bg-success-soft',
    tint: 'text-success',
  },
} as const;

export function AutomationsPanel({ automations }: { automations: MarketingAutomationPrimitives[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {automations.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
}

function AutomationCard({ automation }: { automation: MarketingAutomationPrimitives }) {
  const [editing, setEditing] = useState(false);
  const [state, dispatch, pending] = useActionState(updateAutomationAction, INITIAL);
  const meta = KIND_META[automation.kind];
  const Icon = meta.icon;

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.panel} ${meta.tint}`}>
            <Icon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{meta.title}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{meta.description}</p>
            {automation.kind === 'reactivacion' ? (
              <p className="mt-1 text-xs text-ink-soft">
                Intervalo actual: <span className="font-medium text-ink">{automation.intervalMonths ?? 6} meses</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Toggle rápido: guarda la automatización con el estado invertido. */}
        <form action={dispatch}>
          <input type="hidden" name="tipo" value={automation.kind} />
          <input type="hidden" name="asunto" value={automation.subject} />
          <input type="hidden" name="mensaje" value={automation.body} />
          <input type="hidden" name="intervalo" value={automation.intervalMonths ?? ''} />
          <input type="hidden" name="activa" value={automation.enabled ? '0' : '1'} />
          <button
            type="submit"
            disabled={pending}
            title={automation.enabled ? 'Desactivar automatización' : 'Activar automatización'}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${
              automation.enabled ? 'bg-primary' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
                automation.enabled ? 'left-[1.375rem]' : 'left-0.5'
              }`}
            />
          </button>
        </form>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs font-medium ${automation.enabled ? 'text-success' : 'text-ink-soft'}`}>
          {automation.enabled ? '• Activa' : '• Inactiva'}
        </span>
        <Button type="button" variant="soft" size="sm" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Editar plantilla
        </Button>
      </div>

      {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
      {state.ok && !editing ? <p className="mt-2 text-xs text-success">{state.ok}</p> : null}

      {editing ? (
        <EditModal
          automation={automation}
          pending={pending}
          state={state}
          dispatch={dispatch}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function EditModal({
  automation,
  pending,
  state,
  dispatch,
  onClose,
}: {
  automation: MarketingAutomationPrimitives;
  pending: boolean;
  state: MarketingActionState;
  dispatch: (formData: FormData) => void;
  onClose: () => void;
}) {
  const meta = KIND_META[automation.kind];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Editar recordatorio — {meta.title}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink" title="Cerrar">
            <X size={18} />
          </button>
        </div>
        <form
          action={dispatch}
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            submitFormWithoutNativeReset(event, () => {
              startTransition(() => dispatch(formData));
            });
          }}
          className="space-y-3"
        >
          <input type="hidden" name="tipo" value={automation.kind} />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="activa"
              value="1"
              defaultChecked={automation.enabled}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Automatización activa
          </label>
          {automation.kind === 'reactivacion' ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="intervalo-reactivacion">
                Enviar si la última sesión fue hace más de:
              </label>
              <select
                id="intervalo-reactivacion"
                name="intervalo"
                defaultValue={String(automation.intervalMonths ?? 6)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                {[2, 3, 4, 6, 9, 12].map((months) => (
                  <option key={months} value={months}>
                    {months} meses
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`asunto-${automation.kind}`}>
              Asunto:
            </label>
            <input
              id={`asunto-${automation.kind}`}
              name="asunto"
              defaultValue={automation.subject}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`mensaje-${automation.kind}`}>
              Mensaje:
            </label>
            <textarea
              id={`mensaje-${automation.kind}`}
              name="mensaje"
              rows={8}
              defaultValue={automation.body}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <p className="text-xs text-ink-soft">
            Puedes usar <code>{'{{nombre}}'}</code> para el nombre del paciente, <code>{'{{profesional}}'}</code> para
            tu nombre y <code>{'{{liga_agenda}}'}</code> para la liga de agendar. Se reemplazan automáticamente.
          </p>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-success">{state.ok}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
