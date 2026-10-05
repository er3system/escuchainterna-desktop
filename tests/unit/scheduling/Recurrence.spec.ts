import { describe, it, expect } from 'vitest';
import { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import { InvalidRecurrenceError } from '@/contexts/scheduling/domain/errors/InvalidRecurrenceError';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Recurrence.expandFrom', () => {
  it('expande una serie semanal con N ocurrencias separadas 7 días', () => {
    const recurrence = Recurrence.create('rec-1', 'semanal', 4);
    const first = new Date(2026, 5, 15, 10, 0, 0, 0);
    const dates = recurrence.expandFrom(first);
    expect(dates).toHaveLength(4);
    expect(dates[0].getTime()).toBe(first.getTime());
    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i].getTime() - dates[i - 1].getTime()).toBe(7 * DAY_MS);
    }
  });

  it('expande una serie quincenal separada 14 días', () => {
    const recurrence = Recurrence.create('rec-2', 'quincenal', 3);
    const first = new Date(2026, 5, 15, 10, 0, 0, 0);
    const dates = recurrence.expandFrom(first);
    expect(dates).toHaveLength(3);
    expect(dates[1].getTime() - dates[0].getTime()).toBe(14 * DAY_MS);
    expect(dates[2].getTime() - dates[1].getTime()).toBe(14 * DAY_MS);
  });

  it('conserva la hora de inicio en cada ocurrencia', () => {
    const recurrence = Recurrence.create('rec-3', 'semanal', 2);
    const first = new Date(2026, 5, 15, 17, 30, 0, 0);
    const dates = recurrence.expandFrom(first);
    expect(dates[1].getHours()).toBe(17);
    expect(dates[1].getMinutes()).toBe(30);
  });
});

describe('Recurrence.create (validación)', () => {
  it('rechaza frecuencias no soportadas', () => {
    expect(() => Recurrence.create('rec-x', 'mensual', 4)).toThrow(InvalidRecurrenceError);
  });

  it('rechaza repeticiones fuera de rango', () => {
    expect(() => Recurrence.create('rec-x', 'semanal', 1)).toThrow(InvalidRecurrenceError);
    expect(() => Recurrence.create('rec-x', 'semanal', 53)).toThrow(InvalidRecurrenceError);
    expect(() => Recurrence.create('rec-x', 'semanal', 2.5)).toThrow(InvalidRecurrenceError);
  });
});
