'use client';

import { startTransition, useActionState } from 'react';
import { Bell, CalendarClock, Receipt } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { updateRemindersAction, type RecordatoriosFormState } from './actions';

const INITIAL: RecordatoriosFormState = {};

export function RecordatoriosForm({
  sessionReminderHours,
  cancellationMinHours,
  autoPaymentReminders,
}: {
  sessionReminderHours: number;
  cancellationMinHours: number;
  autoPaymentReminders: boolean;
}) {
  const [state, dispatch, pending] = useActionState(updateRemindersAction, INITIAL);

  return (
    <form
      action={dispatch}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        submitFormWithoutNativeReset(event, () => {
          startTransition(() => dispatch(formData));
        });
      }}
      className="max-w-xl space-y-4"
    >
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            <Bell size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Recordatorio de sesión</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Con cuántas horas de anticipación se registra el recordatorio de cada sesión (WhatsApp y correo).
            </p>
            <label className="mb-1 mt-3 block text-sm font-semibold text-ink" htmlFor="anticipacion">
              Tiempo de anticipación del recordatorio:
            </label>
            <Select id="anticipacion" name="anticipacion" defaultValue={String(sessionReminderHours)}>
              {[12, 24, 36, 48].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} horas
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            <CalendarClock size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Cancelaciones y reagendas</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tiempo mínimo antes de la sesión para que un paciente pueda cancelar o reagendar.
            </p>
            <label className="mb-1 mt-3 block text-sm font-semibold text-ink" htmlFor="cancelacion">
              Tiempo mínimo para reagendar o cancelar:
            </label>
            <Select id="cancelacion" name="cancelacion" defaultValue={String(cancellationMinHours)}>
              <option value="0">Sin restricción</option>
              {[6, 12, 24, 48].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} horas
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            <Receipt size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Recordatorios de pago</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Registra automáticamente un recordatorio de pago para las sesiones con pago pendiente.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="recordatorios_pago"
                value="1"
                defaultChecked={autoPaymentReminders}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Recordatorios de pago automáticos
            </label>
          </div>
        </div>
      </section>

      <p className="text-xs text-ink-soft">
        Los cambios solo aplican a reservaciones nuevas; las existentes conservan su configuración.
      </p>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium text-success">{state.ok}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
