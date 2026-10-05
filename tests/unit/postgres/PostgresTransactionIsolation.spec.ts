import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresAdapter } from '@/shared/infrastructure/persistence/PostgresAdapter';

describe('PostgresAdapter · aislamiento transaccional', () => {
  it('abre la transacción como SERIALIZABLE antes de ejecutar escrituras', async () => {
    const commands: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        commands.push(sql);
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const adapter = new PostgresAdapter(pool);

    await adapter.transaction(async () => {
      await adapter.execute('INSERT INTO example (id) VALUES (?)', ['one']);
    });

    expect(commands).toEqual([
      'BEGIN ISOLATION LEVEL SERIALIZABLE',
      'INSERT INTO example (id) VALUES ($1)',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
