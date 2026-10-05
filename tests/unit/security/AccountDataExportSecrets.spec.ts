import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  query: vi.fn(),
  queryRow: vi.fn(),
}));

vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: () => ({
    query: harness.query,
    queryRow: harness.queryRow,
  }),
}));

import { exportAccountData } from '@/shared/infrastructure/account-data/AccountDataExport';

describe('exportAccountData · secretos de integraciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
    harness.queryRow.mockResolvedValue(null);
    harness.query.mockImplementation(async (sql: string) => {
      if (sql.includes('sqlite_master')) return [{ name: 'integration_connections' }];
      if (sql.includes('PRAGMA table_info(integration_connections)')) {
        return [{ name: 'id' }, { name: 'owner_user_id' }, { name: 'config_json' }];
      }
      if (sql.includes('SELECT * FROM integration_connections')) {
        return [
          {
            id: 'connection-1',
            owner_user_id: 'owner-1',
            provider: 'stripe',
            status: 'conectado',
            config_json: 'enc:cfg:v1:data-v1:iv:tag:ciphertext',
          },
        ];
      }
      return [];
    });
  });

  it('incluye metadatos de conexión pero nunca config_json ni su envelope', async () => {
    const exported = await exportAccountData('owner-1');
    expect(exported.ownedData.integration_connections).toEqual([
      {
        id: 'connection-1',
        owner_user_id: 'owner-1',
        provider: 'stripe',
        status: 'conectado',
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain('config_json');
    expect(JSON.stringify(exported)).not.toContain('enc:cfg:v1');
  });
});
