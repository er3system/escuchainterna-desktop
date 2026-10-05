import { describe, it, expect } from 'vitest';
import { applyLunchBreak } from '@/contexts/scheduling/domain/lunchBreak';

const lunch = { from: '13:00', to: '14:00' };

describe('applyLunchBreak', () => {
  it('parte un rango que contiene el almuerzo en dos', () => {
    const result = applyLunchBreak([{ day: 1, ranges: [{ from: '09:00', to: '17:00' }] }], lunch);
    expect(result).toEqual([
      { day: 1, ranges: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '17:00' }] },
    ]);
  });

  it('deja igual un rango que no toca el almuerzo', () => {
    const value = [{ day: 2, ranges: [{ from: '15:00', to: '18:00' }] }];
    expect(applyLunchBreak(value, lunch)).toEqual(value);
  });

  it('recorta un rango que solapa parcialmente el inicio del almuerzo', () => {
    const result = applyLunchBreak([{ day: 3, ranges: [{ from: '12:00', to: '13:30' }] }], lunch);
    expect(result).toEqual([{ day: 3, ranges: [{ from: '12:00', to: '13:00' }] }]);
  });

  it('recorta un rango que solapa parcialmente el fin del almuerzo', () => {
    const result = applyLunchBreak([{ day: 4, ranges: [{ from: '13:30', to: '17:00' }] }], lunch);
    expect(result).toEqual([{ day: 4, ranges: [{ from: '14:00', to: '17:00' }] }]);
  });

  it('elimina un rango que cae entero dentro del almuerzo (y el día si queda vacío)', () => {
    const result = applyLunchBreak([{ day: 5, ranges: [{ from: '13:15', to: '13:45' }] }], lunch);
    expect(result).toEqual([]);
  });

  it('aplica a varios días y conserva los que sí quedan con rangos', () => {
    const result = applyLunchBreak(
      [
        { day: 1, ranges: [{ from: '09:00', to: '17:00' }] },
        { day: 6, ranges: [{ from: '10:00', to: '12:00' }] }, // no toca el almuerzo
      ],
      lunch,
    );
    expect(result).toEqual([
      { day: 1, ranges: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '17:00' }] },
      { day: 6, ranges: [{ from: '10:00', to: '12:00' }] },
    ]);
  });

  it('respeta rangos múltiples por día', () => {
    const result = applyLunchBreak(
      [{ day: 1, ranges: [{ from: '08:00', to: '13:30' }, { from: '15:00', to: '19:00' }] }],
      lunch,
    );
    expect(result).toEqual([
      { day: 1, ranges: [{ from: '08:00', to: '13:00' }, { from: '15:00', to: '19:00' }] },
    ]);
  });

  it('con ventana inválida (inicio ≥ fin) devuelve el valor sin cambios', () => {
    const value = [{ day: 1, ranges: [{ from: '09:00', to: '17:00' }] }];
    expect(applyLunchBreak(value, { from: '14:00', to: '13:00' })).toEqual(value);
    expect(applyLunchBreak(value, { from: '13:00', to: '13:00' })).toEqual(value);
  });
});
