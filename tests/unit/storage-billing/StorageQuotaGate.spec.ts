import { describe, it, expect } from 'vitest';
import {
  BYTES_PER_GB,
  DEFAULT_STORAGE_LIMIT_GB,
  wouldExceedQuota,
} from '@/shared/infrastructure/storage-billing/StorageQuotaGate';

describe('wouldExceedQuota', () => {
  it('sin límite (admin) nunca excede', () => {
    expect(wouldExceedQuota(100 * BYTES_PER_GB, 50 * BYTES_PER_GB, null)).toBe(false);
  });

  it('permite cuando uso + archivo entra justo en el tope', () => {
    const limit = 5 * BYTES_PER_GB;
    expect(wouldExceedQuota(4 * BYTES_PER_GB, 1 * BYTES_PER_GB, limit)).toBe(false); // == tope, ok
    expect(wouldExceedQuota(4 * BYTES_PER_GB, 1 * BYTES_PER_GB + 1, limit)).toBe(true); // 1 byte de más
  });

  it('excede cuando uso + archivo supera el tope', () => {
    const limit = 5 * BYTES_PER_GB;
    expect(wouldExceedQuota(5 * BYTES_PER_GB, 1, limit)).toBe(true);
    expect(wouldExceedQuota(0, 6 * BYTES_PER_GB, limit)).toBe(true);
  });

  it('BYTES_PER_GB y el default son sensatos', () => {
    expect(BYTES_PER_GB).toBe(1024 * 1024 * 1024);
    expect(DEFAULT_STORAGE_LIMIT_GB).toBeGreaterThan(0);
  });
});
