'use client';

import { useTransition } from 'react';
import { Check, DoorClosed, MapPin } from 'lucide-react';
import { setConsultorioModeAction } from '../actions';

type Mode = 'aislado' | 'compartido';

const OPTIONS: Array<{ value: Mode; title: string; desc: string; icon: typeof DoorClosed }> = [
  {
    value: 'aislado',
    title: 'Aislados',
    desc: 'Cada consultorio es una frontera clínica: un miembro de un consultorio no ve los pacientes de otro.',
    icon: DoorClosed,
  },
  {
    value: 'compartido',
    title: 'Sedes (lista compartida)',
    desc: 'Los consultorios son ubicaciones. Todo el equipo comparte la lista de pacientes (según la política de acceso) y cada ficha indica en qué sede se atiende.',
    icon: MapPin,
  },
];

/**
 * Selector del MODO de consultorios (Modo Sedes, MS1). Cambiar a "Sedes" APAGA el
 * aislamiento por consultorio (decisión sensible), por eso se confirma explícitamente.
 */
export function ConsultorioModeControl({ mode }: { mode: Mode }) {
  const [pending, startTransition] = useTransition();

  const change = (next: Mode) => {
    if (next === mode || pending) return;
    if (
      next === 'compartido' &&
      !window.confirm(
        'En modo "Sedes" los consultorios dejan de aislar: todo el equipo comparte la lista de pacientes según la política de acceso de la organización. ¿Continuar?',
      )
    ) {
      return;
    }
    startTransition(() => setConsultorioModeAction(next));
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const active = option.value === mode;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => change(option.value)}
            disabled={pending}
            aria-pressed={active}
            className={`flex flex-col gap-1.5 rounded-card border p-4 text-left transition disabled:opacity-60 ${
              active ? 'border-primary bg-primary-light' : 'border-line bg-surface hover:border-primary/50'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon size={16} className={active ? 'text-primary' : 'text-ink-soft'} />
              {option.title}
              {active ? <Check size={15} className="ml-auto text-primary" /> : null}
            </span>
            <span className="text-xs text-ink-soft">{option.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
