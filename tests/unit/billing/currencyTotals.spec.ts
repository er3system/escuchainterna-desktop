import { describe, it, expect } from 'vitest';
import {
  currencyLinesOrZero,
  groupAmountsByCurrency,
} from '@/contexts/billing/domain/value-objects/currencyTotals';

describe('groupAmountsByCurrency', () => {
  it('suma los montos por moneda en renglones separados', () => {
    const totals = groupAmountsByCurrency([
      { amount: 500, currency: 'MXN' },
      { amount: 1000, currency: 'MXN' },
      { amount: 200000, currency: 'COP' },
    ]);
    expect(totals).toEqual([
      { currency: 'COP', amount: 200000 },
      { currency: 'MXN', amount: 1500 },
    ]);
  });

  it('ordena por monto descendente y por código como desempate', () => {
    const totals = groupAmountsByCurrency([
      { amount: 100, currency: 'USD' },
      { amount: 100, currency: 'ARS' },
      { amount: 900, currency: 'MXN' },
    ]);
    expect(totals.map((total) => total.currency)).toEqual(['MXN', 'ARS', 'USD']);
  });

  it('trata la moneda vacía como MXN (datos previos a la migración v5)', () => {
    const totals = groupAmountsByCurrency([
      { amount: 500, currency: '' },
      { amount: 500, currency: 'MXN' },
    ]);
    expect(totals).toEqual([{ currency: 'MXN', amount: 1000 }]);
  });

  it('devuelve vacío sin montos', () => {
    expect(groupAmountsByCurrency([])).toEqual([]);
  });
});

describe('currencyLinesOrZero', () => {
  it('rellena con $0 en la moneda del perfil cuando no hay montos', () => {
    expect(currencyLinesOrZero([], 'COP')).toEqual([{ currency: 'COP', amount: 0 }]);
  });

  it('respeta los renglones existentes', () => {
    const totals = [{ currency: 'MXN', amount: 1500 }];
    expect(currencyLinesOrZero(totals, 'COP')).toEqual(totals);
  });
});
