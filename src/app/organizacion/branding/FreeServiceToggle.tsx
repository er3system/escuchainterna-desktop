'use client';

import { useState, useTransition } from 'react';
import { HeartHandshake } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { setFreeServiceAction } from '../actions';

/**
 * Toggle de «Servicio sin costo» (v3 §3, universidades): nuestras consultas
 * son gratuitas para los pacientes. Activa pagos deshabilitados para TODO el
 * equipo y oculta precios en los flujos públicos.
 */
export function FreeServiceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const result = await setFreeServiceAction(next);
      if (result.error) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
            <HeartHandshake size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Servicio sin costo</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Nuestras consultas son gratuitas para los pacientes.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={toggle}
          label="Servicio sin costo: nuestras consultas son gratuitas para los pacientes"
          disabled={pending}
        />
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-soft">
        <li>Todos los miembros del equipo quedan con el módulo de pagos deshabilitado.</li>
        <li>Las páginas públicas de reservas no muestran precios ni botón de pago.</li>
        <li>El onboarding de nuevos miembros salta el paso de tarifas y pagos.</li>
        <li>La liquidación interna queda solo como reporte informativo.</li>
      </ul>
      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
      {pending ? <p className="mt-2 text-xs text-ink-soft">Guardando…</p> : null}
    </div>
  );
}
