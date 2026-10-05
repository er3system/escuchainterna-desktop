import { describe, expect, it } from 'vitest';
import { ListPaymentsQuery } from '@/contexts/billing/application/list-payments/ListPaymentsQuery';

describe('ListPaymentsQuery', () => {
  it('defaults to only completed sessions, like the original product', () => {
    const criteria = ListPaymentsQuery.fromPrimitives({}).toCriteria();
    expect(criteria.onlyCompleted).toBe(true);
    expect(criteria.paymentStatus).toBeUndefined();
    expect(criteria.tags).toBeUndefined();
    expect(criteria.text).toBeUndefined();
  });

  it('disables the completed filter only with the explicit flag "0"', () => {
    expect(ListPaymentsQuery.fromPrimitives({ onlyCompleted: '0' }).toCriteria().onlyCompleted).toBe(false);
    expect(ListPaymentsQuery.fromPrimitives({ onlyCompleted: '1' }).toCriteria().onlyCompleted).toBe(true);
  });

  it('ignores unknown payment statuses', () => {
    expect(ListPaymentsQuery.fromPrimitives({ paymentStatus: 'lo-que-sea' }).toCriteria().paymentStatus).toBeUndefined();
    expect(ListPaymentsQuery.fromPrimitives({ paymentStatus: 'pagada' }).toCriteria().paymentStatus).toBe('pagada');
  });

  it('parses comma separated tags and trims them', () => {
    const criteria = ListPaymentsQuery.fromPrimitives({ tags: ' Pago anticipado , No contesta ,, ' }).toCriteria();
    expect(criteria.tags).toEqual(['Pago anticipado', 'No contesta']);
  });

  it('turns date filters into local day boundaries (to is exclusive)', () => {
    const criteria = ListPaymentsQuery.fromPrimitives({ fromDate: '2026-06-01', toDate: '2026-06-30' }).toCriteria();
    expect(criteria.fromIso).toBe(new Date(2026, 5, 1).toISOString());
    expect(criteria.toIso).toBe(new Date(2026, 6, 1).toISOString());
  });
});
