'use client';

import { useState, useTransition } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { openNewExpedienteAction } from './actions';

type Modo = 'episodio-coexiste' | 'episodio-sella' | 'relevo';

const OPTIONS: { value: Modo; title: string; description: string; sella: boolean; defaultLabel: string }[] = [
  {
    value: 'episodio-coexiste',
    title: 'Nuevo episodio — dejar el anterior abierto',
    description: 'Abres otro expediente que coexiste; el anterior sigue abierto y editable. Útil cuando el paciente vuelve tras un tiempo.',
    sella: false,
    defaultLabel: '',
  },
  {
    value: 'episodio-sella',
    title: 'Nuevo episodio — sellar el anterior',
    description: 'Cierras la etapa anterior (queda de solo lectura) y empiezas una nueva.',
    sella: true,
    defaultLabel: 'Expediente anterior',
  },
  {
    value: 'relevo',
    title: 'Relevo — recibí este paciente',
    description: 'Un colega te cedió el paciente: se sellan TODOS los expedientes anteriores y abres el tuyo.',
    sella: true,
    defaultLabel: 'Expediente del tratante anterior',
  },
];

/**
 * Abrir un expediente nuevo. El profesional decide qué pasa con el anterior:
 * coexistir (no sellar), sellar el vigente, o —en un relevo— sellar todos. Solo
 * los modos que sellan piden rótulo. Tras esto lleva al selector de modelo.
 */
export function OpenNewExpedienteButton({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<Modo>('episodio-coexiste');
  const [label, setLabel] = useState('');
  const [pending, startTransition] = useTransition();

  const selected = OPTIONS.find((option) => option.value === modo)!;

  function choose(next: Modo) {
    setModo(next);
    setLabel(OPTIONS.find((option) => option.value === next)!.defaultLabel);
  }

  function confirm() {
    startTransition(async () => {
      // La acción sella (según el modo) y redirige al selector de modelo (no retorna).
      await openNewExpedienteAction(patientId, modo, label.trim() || selected.defaultLabel);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
      >
        <FilePlus2 size={14} /> Abrir expediente nuevo
      </button>
    );
  }

  return (
    <div className="rounded-card border border-primary/40 bg-primary-light/30 p-3.5 dark:border-accent-2/25 dark:bg-primary/15">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">Abrir un expediente nuevo</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-ink-soft hover:bg-bg hover:text-ink"
          aria-label="Cerrar"
        >
          <X size={15} />
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        Las sesiones y la continuidad clínica se conservan siempre. Tú decides qué pasa con el
        expediente actual.
      </p>

      <div className="space-y-1.5">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
              modo === option.value ? 'border-primary bg-surface' : 'border-line bg-surface/60 hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="modo-expediente"
              checked={modo === option.value}
              onChange={() => choose(option.value)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block font-semibold text-ink">{option.title}</span>
              <span className="block text-ink-soft">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {selected.sella ? (
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-medium text-ink">Rótulo del expediente que se sella</span>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
        >
          Cancelar
        </button>
        <Button
          size="sm"
          type="button"
          onClick={confirm}
          disabled={pending}
          className="disabled:opacity-50"
        >
          {pending ? 'Abriendo…' : selected.sella ? 'Sellar y abrir nuevo' : 'Abrir episodio nuevo'}
        </Button>
      </div>
    </div>
  );
}
