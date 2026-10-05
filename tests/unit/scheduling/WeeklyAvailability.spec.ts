import { describe, it, expect } from 'vitest';
import { WeeklyAvailability } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import { InvalidWeeklyAvailabilityError } from '@/contexts/scheduling/domain/errors/InvalidWeeklyAvailabilityError';

// 2026-06-15 es lunes (day = 1); 2026-06-20 es sábado (day = 6).
const monday = (hours: number, minutes = 0): Date => new Date(2026, 5, 15, hours, minutes, 0, 0);
const saturday = (hours: number): Date => new Date(2026, 5, 20, hours, 0, 0, 0);

const availability = WeeklyAvailability.fromPrimitives([
  { day: 1, ranges: [{ from: '09:00', to: '13:00' }, { from: '16:00', to: '20:00' }] },
]);

describe('WeeklyAvailability.isAvailableAt', () => {
  it('acepta una sesión que cabe completa dentro de un rango', () => {
    expect(availability.isAvailableAt(monday(10), 60)).toBe(true);
  });

  it('acepta una sesión que termina exactamente al cierre del rango', () => {
    expect(availability.isAvailableAt(monday(12), 60)).toBe(true);
  });

  it('rechaza una sesión que cruza el fin del rango', () => {
    expect(availability.isAvailableAt(monday(12, 30), 60)).toBe(false);
  });

  it('rechaza inicios antes del rango', () => {
    expect(availability.isAvailableAt(monday(8), 60)).toBe(false);
  });

  it('rechaza el hueco entre rangos del mismo día', () => {
    expect(availability.isAvailableAt(monday(14), 60)).toBe(false);
  });

  it('acepta el segundo rango del día', () => {
    expect(availability.isAvailableAt(monday(16), 60)).toBe(true);
  });

  it('rechaza días sin disponibilidad', () => {
    expect(availability.isAvailableAt(saturday(10), 60)).toBe(false);
  });

  it('rechaza duraciones no positivas', () => {
    expect(availability.isAvailableAt(monday(10), 0)).toBe(false);
  });
});

describe('WeeklyAvailability.slotStartsForDay', () => {
  it('genera inicios que caben completos, avanzando por intervalo', () => {
    expect(availability.slotStartsForDay(1, 60, 60)).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
    ]);
  });

  it('devuelve vacío para días sin rangos', () => {
    expect(availability.slotStartsForDay(0, 60, 60)).toEqual([]);
  });
});

describe('WeeklyAvailability (validación)', () => {
  it('rechaza días fuera de 0..6', () => {
    expect(() =>
      WeeklyAvailability.fromPrimitives([{ day: 7, ranges: [{ from: '09:00', to: '10:00' }] }]),
    ).toThrow(InvalidWeeklyAvailabilityError);
  });

  it('rechaza rangos con inicio posterior o igual al fin', () => {
    expect(() =>
      WeeklyAvailability.fromPrimitives([{ day: 1, ranges: [{ from: '13:00', to: '09:00' }] }]),
    ).toThrow(InvalidWeeklyAvailabilityError);
  });

  it('rechaza horas mal formadas', () => {
    expect(() =>
      WeeklyAvailability.fromPrimitives([{ day: 1, ranges: [{ from: '9am', to: '10:00' }] }]),
    ).toThrow(InvalidWeeklyAvailabilityError);
  });

  it('rechaza rangos solapados en el mismo día', () => {
    expect(() =>
      WeeklyAvailability.fromPrimitives([
        { day: 1, ranges: [{ from: '09:00', to: '12:00' }, { from: '11:00', to: '14:00' }] },
      ]),
    ).toThrow(InvalidWeeklyAvailabilityError);
  });

  it('rechaza días duplicados', () => {
    expect(() =>
      WeeklyAvailability.fromPrimitives([
        { day: 1, ranges: [{ from: '09:00', to: '12:00' }] },
        { day: 1, ranges: [{ from: '13:00', to: '14:00' }] },
      ]),
    ).toThrow(InvalidWeeklyAvailabilityError);
  });
});
