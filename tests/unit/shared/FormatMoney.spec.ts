import { describe, it, expect } from 'vitest';
import { formatMoney as formatAgendaMoney } from '@/app/(app)/agenda/agendaTypes';
import { MoneyAmount } from '@/contexts/billing/domain/value-objects/MoneyAmount';
import { formatMoney, formatMoneyWithCode } from '@/shared/domain/currencies';

describe('formatMoneyWithCode', () => {
  it('muestra el código ISO exactamente una vez para cada divisa soportada', () => {
    for (const code of ['MXN', 'COP', 'USD', 'PEN', 'ARS', 'EUR']) {
      const result = formatMoneyWithCode(1500.5, code);
      expect(result.split(code).length - 1).toBe(1);
    }
  });

  it('parte del formato local de formatMoney y le añade el código si falta', () => {
    const plain = formatMoney(1500, 'MXN');
    const withCode = formatMoneyWithCode(1500, 'MXN');
    expect(withCode.startsWith(plain)).toBe(true);
    expect(withCode.endsWith('MXN')).toBe(true);
  });

  it('mantiene el código ISO para montos en cero', () => {
    expect(formatMoneyWithCode(0, 'COP')).toContain('COP');
  });

  it.each(['COP', 'PEN', 'EUR'])('mantiene formato local y código ISO en agenda y facturación para %s', (code) => {
    const expected = formatMoneyWithCode(1500.5, code);

    expect(formatAgendaMoney(1500.5, code)).toBe(expected);
    expect(new MoneyAmount(1500.5).formatted(code)).toBe(expected);
    expect(expected).toContain(code);
  });
});
