import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  findById: vi.fn(),
}));

vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  getActiveAppSessionContext: vi.fn(async () =>
    harness.sessionUserId ? { userId: harness.sessionUserId } : null,
  ),
}));

vi.mock('@/contexts/library/infrastructure/persistence/SqliteBookRepository', () => ({
  SqliteBookRepository: class {
    findById = harness.findById;
  },
}));

vi.mock('@/contexts/library/infrastructure/filesystem/LibraryFolderScanner', () => ({
  libraryRootPath: () => 'C:\\data\\biblioteca',
}));

describe('legacy library file route', () => {
  beforeEach(() => {
    harness.sessionUserId = null;
    harness.findById.mockReset();
  });

  it('rejects unauthenticated downloads before looking up a book', async () => {
    const { GET } = await import('@/app/api/biblioteca/[id]/file/route');

    const response = await GET({} as never, {
      params: Promise.resolve({ id: 'book-1' }),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('No autorizado');
    expect(harness.findById).not.toHaveBeenCalled();
  });

  it('keeps the authenticated not-found response', async () => {
    harness.sessionUserId = 'user-1';
    harness.findById.mockResolvedValue(null);
    const { GET } = await import('@/app/api/biblioteca/[id]/file/route');

    const response = await GET({} as never, {
      params: Promise.resolve({ id: 'missing' }),
    });

    expect(response.status).toBe(404);
    expect(harness.findById).toHaveBeenCalledWith('missing');
  });
});
