import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';

/**
 * Integración del PostgresAdapter contra un Postgres REAL (fase 0d).
 *
 * Se SALTA si no hay `PG_TEST_URL` en el entorno (la suite normal corre contra
 * SQLite). Correr SOLO este archivo, aislado (setea DATABASE_URL en el proceso):
 *   docker compose up -d
 *   PG_TEST_URL=postgres://escucha:escucha@localhost:5432/escuchainterna \
 *     npx vitest run tests/unit/postgres/PostgresAdapter.spec.ts
 *
 * OJO: hace DROP SCHEMA public CASCADE — usar SOLO contra una BD desechable.
 */

const PG_URL = process.env.PG_TEST_URL;
const suite = PG_URL ? describe : describe.skip;

let adapter: DatabaseAdapter & { close?: () => Promise<void> };
let latestVersion: number;

const NOW = '2026-01-01T00:00:00.000Z';

const INSERT_USER = `INSERT INTO users (id, email, password_hash, role, status, created_at)
   VALUES (?, ?, 'hash', 'psychologist', 'activo', ?)`;

suite('PostgresAdapter · integración contra Postgres real', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = PG_URL;
    const g = globalThis as Record<string, unknown>;
    delete g.__escuchainternaDbAdapter;
    delete g.__escuchainternaPgAdapter;
    delete g.__escuchainternaPgPool;

    const { getDatabaseAdapter } = await import('@/shared/infrastructure/persistence/SqliteAdapter');
    adapter = getDatabaseAdapter() as typeof adapter;
    const migrations = await import('@/shared/infrastructure/persistence/migrations');
    latestVersion = migrations.LATEST_SCHEMA_VERSION;

    // Esquema limpio para una corrida idempotente.
    await adapter.execute('DROP SCHEMA IF EXISTS public CASCADE');
    await adapter.execute('CREATE SCHEMA public');
    await migrations.runMigrationsOnAdapter(adapter);
  }, 120_000);

  afterAll(async () => {
    await adapter?.close?.();
    delete process.env.DATABASE_URL;
  });

  it('aplica todas las migraciones (schema_migrations al día)', async () => {
    const row = await adapter.queryRow<{ v: number }>(
      'SELECT MAX(version) AS v FROM schema_migrations',
    );
    expect(row?.v).toBe(latestVersion);
  });

  it('traduce ?→$n y hace round-trip de filas', async () => {
    await adapter.execute(INSERT_USER, ['u1', 'a@t.test', NOW]);
    const rows = await adapter.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = ?',
      ['a@t.test'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('u1');
  });

  it('COUNT(*) vuelve como number (no string, como en SQLite)', async () => {
    const row = await adapter.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM users');
    expect(typeof row?.n).toBe('number');
    expect(row?.n).toBe(1);
  });

  it('transacción: commit persiste, rollback descarta (atomicidad)', async () => {
    await adapter.transaction(async () => {
      await adapter.execute(INSERT_USER, ['u2', 'b@t.test', NOW]);
    });
    const committed = await adapter.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM users WHERE id = ?',
      ['u2'],
    );
    expect(committed?.n).toBe(1);

    await expect(
      adapter.transaction(async () => {
        await adapter.execute(INSERT_USER, ['u3', 'c@t.test', NOW]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rolledBack = await adapter.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM users WHERE id = ?',
      ['u3'],
    );
    expect(rolledBack?.n).toBe(0);
  });

  it('afterCommit corre tras COMMIT y se descarta en ROLLBACK', async () => {
    let ran = 0;
    await adapter.transaction(async () => {
      await adapter.execute(INSERT_USER, ['u4', 'd@t.test', NOW]);
      adapter.afterCommit(() => {
        ran += 1;
      });
    });
    expect(ran).toBe(1);

    await expect(
      adapter.transaction(async () => {
        adapter.afterCommit(() => {
          ran += 1;
        });
        throw new Error('nope');
      }),
    ).rejects.toThrow();
    expect(ran).toBe(1); // el efecto del rollback NO corrió
  });

  it('repo real (notifications): insert + idempotente ON CONFLICT DO NOTHING + countUnread', async () => {
    const { SqliteNotificationRepository } = await import(
      '@/contexts/notifications/infrastructure/persistence/SqliteNotificationRepository'
    );
    const repo = new SqliteNotificationRepository(adapter);
    await repo.insert({ recipientUserId: 'u1', kind: 'recordatorio', title: 'Hola' });
    await repo.insertIdempotent('fixed-id', { recipientUserId: 'u1', kind: 'novedad', title: 'X' });
    await repo.insertIdempotent('fixed-id', { recipientUserId: 'u1', kind: 'novedad', title: 'X' });
    const unread = await repo.countUnread('u1', new Date(Date.now() + 60_000).toISOString());
    expect(unread).toBe(2); // la 2ª inserción idempotente NO duplicó
  });

  it('ON CONFLICT(target) DO UPDATE hace upsert (reescritura de INSERT OR REPLACE)', async () => {
    const sql = `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
                 ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`;
    await adapter.execute(sql, ['pg-test-key', '{"v":1}']);
    await adapter.execute(sql, ['pg-test-key', '{"v":2}']); // mismo key → ACTUALIZA, no duplica
    const rows = await adapter.query<{ value_json: string }>(
      'SELECT value_json FROM platform_settings WHERE key = ?',
      ['pg-test-key'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].value_json).toBe('{"v":2}');
  });

  it('LOWER(col) ordena case-insensitive (equivalente a COLLATE NOCASE)', async () => {
    await adapter.execute(INSERT_USER, ['u5', 'bravo@t.test', NOW]);
    await adapter.execute(INSERT_USER, ['u6', 'Alpha@t.test', NOW]);
    const rows = await adapter.query<{ email: string }>(
      "SELECT email FROM users WHERE id IN ('u5','u6') ORDER BY LOWER(email) ASC",
    );
    expect(rows.map((r) => r.email)).toEqual(['Alpha@t.test', 'bravo@t.test']);
  });

  it('automatizaciones: permite el mismo kind en owners distintos y lo impide dentro del mismo owner', async () => {
    await adapter.execute(INSERT_USER, ['marketing-owner-a', 'marketing-a@t.test', NOW]);
    await adapter.execute(INSERT_USER, ['marketing-owner-b', 'marketing-b@t.test', NOW]);
    const insert = `INSERT INTO marketing_automations
      (id, owner_user_id, kind, enabled, interval_months, subject, body)
      VALUES (?, ?, 'cumpleanios', 0, NULL, '', '')`;

    await adapter.execute(insert, ['marketing-automation-a', 'marketing-owner-a']);
    await adapter.execute(insert, ['marketing-automation-b', 'marketing-owner-b']);

    const rows = await adapter.query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM marketing_automations
        WHERE kind = 'cumpleanios' ORDER BY owner_user_id`,
    );
    expect(rows.map((row) => row.owner_user_id)).toEqual([
      'marketing-owner-a',
      'marketing-owner-b',
    ]);
    await expect(
      adapter.execute(insert, ['marketing-automation-duplicate', 'marketing-owner-a']),
    ).rejects.toThrow();
  });

  it('cifra configuraciones legacy de integraciones y el repositorio las vuelve a leer', async () => {
    await adapter.execute(INSERT_USER, ['integration-owner', 'integration@t.test', NOW]);
    await adapter.execute(
      `INSERT INTO integration_connections
         (id, provider, owner_user_id, status, config_json, connected_at)
       VALUES (?, 'stripe', ?, 'conectado', ?, ?)`,
      [
        'pg-integration-connection',
        'integration-owner',
        JSON.stringify({ secret_key: 'pg-secret', show_payment_button: 'true' }),
        NOW,
      ],
    );
    const { encryptExistingIntegrationConfigsOnAdapter } = await import(
      '@/shared/infrastructure/persistence/integrationConfigEncryption'
    );
    expect(await encryptExistingIntegrationConfigsOnAdapter(adapter)).toBe(1);

    const stored = await adapter.queryRow<{ config_json: string }>(
      'SELECT config_json FROM integration_connections WHERE id = ?',
      ['pg-integration-connection'],
    );
    expect(stored?.config_json).toMatch(/^enc:cfg:v1:/);
    expect(stored?.config_json).not.toContain('pg-secret');

    const { SqlitePaymentGatewayRepository } = await import(
      '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository'
    );
    const settings = await new SqlitePaymentGatewayRepository(adapter).find(
      'stripe',
      'integration-owner',
    );
    expect(settings?.secretKey).toBe('pg-secret');
  });
});
