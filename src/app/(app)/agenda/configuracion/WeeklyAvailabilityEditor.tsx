'use client';

import { useState } from 'react';
import { Plus, Utensils, X } from 'lucide-react';
import type { DayAvailabilityPrimitives } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import { applyLunchBreak } from '@/contexts/scheduling/domain/lunchBreak';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const TIME_INPUT =
  'rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light';

export type { DayAvailabilityPrimitives };

/** Editor semanal de disponibilidad: días activables y múltiples rangos por día. */
export function WeeklyAvailabilityEditor({
  value,
  onChange,
  disabled,
}: {
  value: DayAvailabilityPrimitives[];
  onChange: (next: DayAvailabilityPrimitives[]) => void;
  disabled?: boolean;
}) {
  const [lunchFrom, setLunchFrom] = useState('13:00');
  const [lunchTo, setLunchTo] = useState('14:00');

  const rangesFor = (day: number) => value.find((entry) => entry.day === day)?.ranges ?? [];

  const setRanges = (day: number, ranges: Array<{ from: string; to: string }>) => {
    const others = value.filter((entry) => entry.day !== day);
    const next = ranges.length > 0 ? [...others, { day, ranges }] : others;
    onChange(next.sort((a, b) => a.day - b.day));
  };

  const lunchValid = lunchFrom < lunchTo;
  const applyLunch = () => {
    if (!lunchValid) return;
    onChange(applyLunchBreak(value, { from: lunchFrom, to: lunchTo }));
  };

  return (
    <div className="space-y-2">
      {DAY_ORDER.map((day) => {
        const ranges = rangesFor(day);
        const active = ranges.length > 0;
        return (
          <div key={day} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2">
            <label className="mt-1.5 flex w-16 shrink-0 items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={active}
                disabled={disabled}
                onChange={(event) =>
                  setRanges(day, event.target.checked ? [{ from: '09:00', to: '17:00' }] : [])
                }
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {DAY_LABELS[day]}
            </label>
            <div className="flex-1">
              {active ? (
                <div className="space-y-1.5">
                  {ranges.map((range, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={range.from}
                        disabled={disabled}
                        onChange={(event) => {
                          const next = ranges.map((item, i) =>
                            i === index ? { ...item, from: event.target.value } : item,
                          );
                          setRanges(day, next);
                        }}
                        className={TIME_INPUT}
                      />
                      <span className="text-sm text-ink-soft">–</span>
                      <input
                        type="time"
                        value={range.to}
                        disabled={disabled}
                        onChange={(event) => {
                          const next = ranges.map((item, i) =>
                            i === index ? { ...item, to: event.target.value } : item,
                          );
                          setRanges(day, next);
                        }}
                        className={TIME_INPUT}
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setRanges(day, ranges.filter((_, i) => i !== index))}
                        aria-label="Quitar rango"
                        className="rounded-lg p-1 text-ink-soft transition hover:bg-bg hover:text-danger disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                      {index === ranges.length - 1 ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const last = ranges[ranges.length - 1];
                            setRanges(day, [...ranges, { from: last.to, to: '21:00' }]);
                          }}
                          aria-label="Añadir rango"
                          className="rounded-lg p-1 text-ink-soft transition hover:bg-bg hover:text-primary disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-1.5 text-sm text-ink-soft">No disponible</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Atajo: pausa de almuerzo. Parte los rangos de los días activos para
          dejar libre la franja, ahorrando configurarlo día por día. */}
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Utensils size={15} className="text-ink-soft" /> Pausa de almuerzo
        </span>
        <input
          type="time"
          value={lunchFrom}
          disabled={disabled}
          onChange={(event) => setLunchFrom(event.target.value)}
          className={TIME_INPUT}
          aria-label="Inicio del almuerzo"
        />
        <span className="text-sm text-ink-soft">–</span>
        <input
          type="time"
          value={lunchTo}
          disabled={disabled}
          onChange={(event) => setLunchTo(event.target.value)}
          className={TIME_INPUT}
          aria-label="Fin del almuerzo"
        />
        <button
          type="button"
          disabled={disabled || !lunchValid}
          onClick={applyLunch}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-bg disabled:opacity-50"
        >
          Aplicar a los días activos
        </button>
        <span className="w-full text-xs text-ink-soft sm:w-auto sm:flex-1 sm:text-right">
          Deja libre esa franja en los días con disponibilidad.
        </span>
      </div>
    </div>
  );
}
