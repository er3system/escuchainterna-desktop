import { describe, it, expect } from 'vitest';
import { computeFreeGaps } from '@/app/(app)/agenda/freeSlots';

const NINE = 9 * 60; // 09:00
const availability = [{ from: '09:00', to: '18:00' }];

describe('computeFreeGaps', () => {
  it('sin disponibilidad → sin huecos', () => {
    expect(computeFreeGaps([], [{ start: 600, end: 660 }], 0)).toEqual([]);
  });

  it('día libre desde "ahora" → un solo hueco hasta el cierre', () => {
    expect(computeFreeGaps(availability, [], NINE)).toEqual([{ from: '09:00', to: '18:00' }]);
  });

  it('resta una cita en medio → huecos antes y después', () => {
    // 10:00–11:00 ocupado
    const gaps = computeFreeGaps(availability, [{ start: 600, end: 660 }], NINE);
    expect(gaps).toEqual([
      { from: '09:00', to: '10:00' },
      { from: '11:00', to: '18:00' },
    ]);
  });

  it('recorta lo anterior a "ahora" (fromMin)', () => {
    // ahora = 15:30; solo cuenta de 15:30 en adelante
    const gaps = computeFreeGaps(availability, [], 15 * 60 + 30);
    expect(gaps).toEqual([{ from: '15:30', to: '18:00' }]);
  });

  it('descarta huecos menores al mínimo (30 min por defecto)', () => {
    // 09:00–09:20 libre (20 min) se descarta; 09:20–18:00 ocupado por una cita larga deja nada útil
    const gaps = computeFreeGaps(availability, [{ start: 9 * 60 + 20, end: 18 * 60 }], NINE);
    expect(gaps).toEqual([]);
  });

  it('fusiona/ignora ocupados solapados entre sí', () => {
    // dos citas solapadas 10:00–11:00 y 10:30–12:00 → ocupado efectivo 10:00–12:00
    const gaps = computeFreeGaps(
      availability,
      [
        { start: 600, end: 660 },
        { start: 630, end: 720 },
      ],
      NINE,
    );
    expect(gaps).toEqual([
      { from: '09:00', to: '10:00' },
      { from: '12:00', to: '18:00' },
    ]);
  });
});
