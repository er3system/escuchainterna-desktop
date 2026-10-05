import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  queryRow: vi.fn(),
  read: vi.fn(),
}));

vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: () => ({ queryRow: harness.queryRow }),
}));

vi.mock('@/shared/infrastructure/files/getFileStorage', () => ({
  getFileStorage: () => ({ read: harness.read }),
}));

describe('organization logo route', () => {
  beforeEach(() => {
    harness.queryRow.mockReset();
    harness.read.mockReset();
  });

  it('sandboxes SVG logos and disables MIME sniffing', async () => {
    harness.queryRow.mockResolvedValue({ logo_path: 'orgs/org-1/logo.svg' });
    harness.read.mockResolvedValue(new TextEncoder().encode('<svg></svg>'));
    const { GET } = await import('@/app/api/organizaciones/[id]/logo/route');

    const response = await GET({} as Request, {
      params: Promise.resolve({ id: 'org-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
