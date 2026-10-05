import { describe, it, expect } from 'vitest';
import { BlockedSlot } from '@/contexts/scheduling/domain/BlockedSlot';
import { InvalidBlockedSlotError } from '@/contexts/scheduling/domain/errors/InvalidBlockedSlotError';

function at(hours: number, minutes = 0): Date {
  return new Date(2026, 5, 22, hours, minutes, 0, 0); // lunes 22 jun 2026
}

describe('BlockedSlot', () => {
  it('crea un bloqueo válido y recorta el título', () => {
    const slot = BlockedSlot.create({ id: 'b1', startAt: at(13), endAt: at(14), title: '  Almuerzo  ' });
    expect(slot.blockedSlotId()).toBe('b1');
    expect(slot.titleValue()).toBe('Almuerzo');
    expect(slot.start().getTime()).toBe(at(13).getTime());
    expect(slot.end().getTime()).toBe(at(14).getTime());
  });

  it('permite título vacío', () => {
    const slot = BlockedSlot.create({ id: 'b2', startAt: at(13), endAt: at(14) });
    expect(slot.titleValue()).toBe('');
  });

  it('rechaza un fin anterior o igual al inicio', () => {
    expect(() => BlockedSlot.create({ id: 'b3', startAt: at(14), endAt: at(13) })).toThrow(
      InvalidBlockedSlotError,
    );
    expect(() => BlockedSlot.create({ id: 'b4', startAt: at(13), endAt: at(13) })).toThrow(
      InvalidBlockedSlotError,
    );
  });

  it('rechaza fechas inválidas', () => {
    expect(() =>
      BlockedSlot.create({ id: 'b5', startAt: new Date('no-es-fecha'), endAt: at(14) }),
    ).toThrow(InvalidBlockedSlotError);
  });

  it('overlaps detecta el traslape de intervalos [start, end)', () => {
    const slot = BlockedSlot.create({ id: 'b6', startAt: at(13), endAt: at(14) });
    expect(slot.overlaps(at(13, 30), at(14, 30))).toBe(true); // se mete dentro
    expect(slot.overlaps(at(12), at(13, 30))).toBe(true); // empieza antes y entra
    expect(slot.overlaps(at(14), at(15))).toBe(false); // justo después (borde abierto)
    expect(slot.overlaps(at(12), at(13))).toBe(false); // justo antes (borde abierto)
  });

  it('round-trips por primitives', () => {
    const slot = BlockedSlot.create({ id: 'b7', startAt: at(9), endAt: at(10), title: 'Cita médica' });
    const restored = BlockedSlot.fromPrimitives(slot.toPrimitives());
    expect(restored.toPrimitives()).toEqual(slot.toPrimitives());
  });
});
