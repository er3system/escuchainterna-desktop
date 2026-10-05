import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { UUID } from '@haskou/value-objects';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';
import { PersonalProviderCredentials } from '@/contexts/practitioner/domain/value-objects/PersonalProviderCredentials';
import type {
  DatabaseAdapter,
  SqlParam,
} from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { SqlitePaymentGatewayRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository';
import {
  clearIntegrationCredentials,
  listIntegrationConnections,
  saveIntegrationCredentials,
} from '@/app/(app)/configuracion/integraciones/integrationConnections';
import {
  redactIntegrationSecrets,
  REDACTED_INTEGRATION_SECRET,
} from '@/contexts/practitioner/domain/integrationCredentials';

class MemoryAdapter implements DatabaseAdapter {
  public constructor(public readonly sqlite: DatabaseSync) {}

  public async query<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row[]> {
    return this.sqlite.prepare(sql).all(...params) as unknown as Row[];
  }

  public async queryRow<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row | null> {
    return (this.sqlite.prepare(sql).get(...params) as Row | undefined) ?? null;
  }

  public async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    this.sqlite.prepare(sql).run(...params);
  }

  public async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    this.sqlite.exec('BEGIN');
    try {
      const result = await fn();
      this.sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  public afterCommit(effect: () => void): void {
    effect();
  }
}

let sqlite: DatabaseSync;
let db: MemoryAdapter;

beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = 'integration-persistence-test-key-0123456789';
  delete (globalThis as { __escuchainternaIntegrationKeys?: unknown })
    .__escuchainternaIntegrationKeys;
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE integration_connections (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'desconectado',
      config_json TEXT NOT NULL DEFAULT '{}',
      connected_at TEXT,
      UNIQUE(provider, owner_user_id)
    );
  `);
  db = new MemoryAdapter(sqlite);
});

afterEach(() => {
  sqlite.close();
  delete process.env.DATA_ENCRYPTION_KEY;
  delete (globalThis as { __escuchainternaIntegrationKeys?: unknown })
    .__escuchainternaIntegrationKeys;
});

function storedConfig(provider: string, ownerUserId: string): string {
  return (
    sqlite
      .prepare(
        'SELECT config_json FROM integration_connections WHERE provider = ? AND owner_user_id = ?',
      )
      .get(provider, ownerUserId) as { config_json: string }
  ).config_json;
}

describe('proveedores personales de la edición PC', () => {
  const owner = new UUID('11111111-1111-4111-8111-111111111111');
  const other = new UUID('22222222-2222-4222-8222-222222222222');
  it('cifra la clave, no la revela al cliente y nunca usa la cuenta de otro profesional', async () => {
    const repo = new SqlitePersonalProviderRepository(db);
    await repo.save(owner, PersonalProviderCredentials.create('resend', 're_secret_personal_123456789', '', 'consulta@example.test', true));
    expect(storedConfig('resend', owner.toString())).not.toContain('re_secret_personal');
    expect(await repo.find(other.toString(), 'resend')).toBeNull();
    const config = await repo.find(owner.toString(), 'resend');
    expect(config?.sender).toBe('consulta@example.test');
    expect(redactIntegrationSecrets({ api_key: config!.api_key }).api_key).toBe(REDACTED_INTEGRATION_SECRET);
    await repo.disconnect(owner, 'resend');
    expect(await repo.find(owner.toString(), 'resend')).toBeNull();
    expect(storedConfig('resend', owner.toString())).toBe('{}');
  });
  it('cambiar de IA desactiva el proveedor anterior solo para su dueño', async () => {
    const repo = new SqlitePersonalProviderRepository(db);
    const claude = PersonalProviderCredentials.create('anthropic', 'sk-ant-personal_123456789', 'claude-test', '', true);
    await repo.save(owner, claude);
    await repo.save(other, claude);
    await repo.save(owner, PersonalProviderCredentials.create('openai', 'sk-openai_personal_123456789', 'openai-test', '', true));
    expect((await repo.activeAi(owner.toString()))?.provider).toBe('openai');
    expect(await repo.find(owner.toString(), 'anthropic')).toBeNull();
    expect((await repo.activeAi(other.toString()))?.provider).toBe('anthropic');
  });
  it('rechaza autorizaciones ausentes, proveedores no implementados y remitentes incompletos', () => {
    expect(() => PersonalProviderCredentials.create('openai', 'sk-openai_personal_123456789', 'test-model', '', false)).toThrow('Autoriza');
    expect(() => PersonalProviderCredentials.create('whatsapp', 'whatever_123456789', '', '', true)).toThrow('compatible');
    expect(() => PersonalProviderCredentials.create('resend', 're_secret_personal_123456789', '', '', true)).toThrow('remitente');
    expect(() => PersonalProviderCredentials.create('openai', 'sk-openai_personal_123456789', 'model\nInjected', '', true)).toThrow('modelo');
  });
});

describe('persistencia cifrada de credenciales de integraciones', () => {
  it('cifra pasarelas al escribir y preserva un secreto omitido', async () => {
    const repo = new SqlitePaymentGatewayRepository(db);
    await repo.saveManualConfig('stripe', 'owner-a', {
      secret_key: 'sk_live_never-plaintext',
      show_payment_button: 'true',
    });

    const firstStored = storedConfig('stripe', 'owner-a');
    expect(firstStored).toMatch(/^enc:cfg:v1:/);
    expect(firstStored).not.toContain('sk_live_never-plaintext');
    expect((await repo.find('stripe', 'owner-a'))?.secretKey).toBe(
      'sk_live_never-plaintext',
    );

    await repo.saveManualConfig('stripe', 'owner-a', {
      secret_key: '',
      payment_link: 'https://buy.stripe.com/abc',
      show_payment_button: 'true',
    });
    const settings = await repo.find('stripe', 'owner-a');
    expect(settings?.secretKey).toBe('sk_live_never-plaintext');
    expect(settings?.stripePaymentLink).toBe('https://buy.stripe.com/abc');
  });

  it('Google Calendar cifra el secreto, lo conserva si el input queda vacío y lo borra explícitamente', async () => {
    await saveIntegrationCredentials(
      'google_calendar',
      { client_id: 'calendar-client', client_secret: 'calendar-secret' },
      'owner-b',
      db,
    );
    expect(storedConfig('google_calendar', 'owner-b')).toMatch(/^enc:cfg:v1:/);
    expect(storedConfig('google_calendar', 'owner-b')).not.toContain('calendar-secret');

    await saveIntegrationCredentials(
      'google_calendar',
      { client_id: 'calendar-client-updated' },
      'owner-b',
      db,
    );
    const connection = (await listIntegrationConnections('owner-b', db)).find(
      (item) => item.provider === 'google_calendar',
    );
    expect(connection?.config).toMatchObject({
      client_id: 'calendar-client-updated',
      client_secret: 'calendar-secret',
    });

    await clearIntegrationCredentials('google_calendar', 'owner-b', db);
    expect(storedConfig('google_calendar', 'owner-b')).toBe('{}');
    expect(
      (await listIntegrationConnections('owner-b', db)).find(
        (item) => item.provider === 'google_calendar',
      )?.status,
    ).toBe('desconectado');
  });

  it('la proyección cliente conserva presencia sin serializar valores sensibles', () => {
    const safe = redactIntegrationSecrets({
      secret_key: 'sk_live_secret',
      access_token: 'APP_USR-secret',
      client_secret: 'google-secret',
      payment_link: 'https://buy.stripe.com/abc',
    });
    expect(safe).toEqual({
      secret_key: REDACTED_INTEGRATION_SECRET,
      access_token: REDACTED_INTEGRATION_SECRET,
      client_secret: REDACTED_INTEGRATION_SECRET,
      payment_link: 'https://buy.stripe.com/abc',
    });
    expect(JSON.stringify(safe)).not.toContain('sk_live_secret');
    expect(JSON.stringify(safe)).not.toContain('APP_USR-secret');
    expect(JSON.stringify(safe)).not.toContain('google-secret');
  });
});
