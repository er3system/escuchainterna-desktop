import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const ORIGINAL_DATA_KEY = process.env.DATA_ENCRYPTION_KEY;

let encryptIntegrationConfig: typeof import('@/shared/infrastructure/crypto/IntegrationConfigEncryption')['encryptIntegrationConfig'];
let decryptIntegrationConfig: typeof import('@/shared/infrastructure/crypto/IntegrationConfigEncryption')['decryptIntegrationConfig'];
let isEncryptedIntegrationConfig: typeof import('@/shared/infrastructure/crypto/IntegrationConfigEncryption')['isEncryptedIntegrationConfig'];
let encryptExistingIntegrationConfigs: typeof import('@/shared/infrastructure/persistence/integrationConfigEncryption')['encryptExistingIntegrationConfigs'];

const context = {
  id: 'connection-1',
  provider: 'stripe',
  ownerUserId: 'owner-1',
};

beforeAll(async () => {
  process.env.DATA_ENCRYPTION_KEY = 'integration-config-test-key-0123456789abcdef';
  delete (globalThis as { __escuchainternaIntegrationKeys?: unknown })
    .__escuchainternaIntegrationKeys;
  ({ encryptIntegrationConfig, decryptIntegrationConfig, isEncryptedIntegrationConfig } =
    await import('@/shared/infrastructure/crypto/IntegrationConfigEncryption'));
  ({ encryptExistingIntegrationConfigs } = await import(
    '@/shared/infrastructure/persistence/integrationConfigEncryption'
  ));
});

afterAll(() => {
  if (ORIGINAL_DATA_KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = ORIGINAL_DATA_KEY;
  delete (globalThis as { __escuchainternaIntegrationKeys?: unknown })
    .__escuchainternaIntegrationKeys;
});

describe('IntegrationConfigEncryption', () => {
  it('cifra el JSON completo con IV aleatorio y hace round-trip', () => {
    const config = { secret_key: 'sk_live_super-secret', show_payment_button: 'true' };
    const first = encryptIntegrationConfig(config, context);
    const second = encryptIntegrationConfig(config, context);

    expect(isEncryptedIntegrationConfig(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(first).not.toContain('sk_live_super-secret');
    expect(decryptIntegrationConfig(first, context)).toEqual(config);
  });

  it('liga el envelope a fila, proveedor y dueño mediante AAD', () => {
    const stored = encryptIntegrationConfig({ access_token: 'token' }, context);
    expect(() =>
      decryptIntegrationConfig(stored, { ...context, ownerUserId: 'owner-2' }),
    ).toThrow('No se pudo descifrar');
    expect(() =>
      decryptIntegrationConfig(stored, { ...context, provider: 'mercado_pago' }),
    ).toThrow('No se pudo descifrar');
  });

  it('falla cerrado ante corrupción y no devuelve el ciphertext como config vacía', () => {
    const stored = encryptIntegrationConfig({ client_secret: 'secret' }, context);
    const parts = stored.split(':');
    const ciphertext = parts.at(-1) ?? '';
    const replacement = ciphertext.startsWith('A') ? 'B' : 'A';
    parts[parts.length - 1] = `${replacement}${ciphertext.slice(1)}`;
    expect(() => decryptIntegrationConfig(parts.join(':'), context)).toThrow(
      'No se pudo descifrar',
    );
  });

  it('mantiene lectura dual de JSON legacy pero rechaza JSON inválido', () => {
    expect(decryptIntegrationConfig('{"client_id":"legacy"}', context)).toEqual({
      client_id: 'legacy',
    });
    expect(() => decryptIntegrationConfig('{"client_id":42}', context)).toThrow(
      'valor no permitido',
    );
    expect(() => decryptIntegrationConfig('enc:v9:desconocido', context)).toThrow(
      'Formato de cifrado',
    );
  });

  it('migra plaintext de SQLite, valida envelopes e ignora el sentinel vacío', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE integration_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        config_json TEXT NOT NULL
      );
      CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    `);
    db.prepare('INSERT INTO integration_connections VALUES (?, ?, ?, ?)').run(
      context.id,
      context.provider,
      context.ownerUserId,
      JSON.stringify({ secret_key: 'legacy-secret' }),
    );
    db.prepare('INSERT INTO integration_connections VALUES (?, ?, ?, ?)').run(
      'empty',
      'paypal',
      'owner-1',
      '{}',
    );
    const alreadyContext = {
      id: 'already',
      provider: 'google_calendar',
      ownerUserId: 'owner-1',
    };
    const alreadyEncrypted = encryptIntegrationConfig(
      { client_secret: 'already-safe' },
      alreadyContext,
    );
    db.prepare('INSERT INTO integration_connections VALUES (?, ?, ?, ?)').run(
      alreadyContext.id,
      alreadyContext.provider,
      alreadyContext.ownerUserId,
      alreadyEncrypted,
    );

    expect(encryptExistingIntegrationConfigs(db)).toBe(1);
    const legacyStored = db
      .prepare('SELECT config_json FROM integration_connections WHERE id = ?')
      .get(context.id) as { config_json: string };
    expect(isEncryptedIntegrationConfig(legacyStored.config_json)).toBe(true);
    expect(decryptIntegrationConfig(legacyStored.config_json, context)).toEqual({
      secret_key: 'legacy-secret',
    });
    expect(
      (
        db.prepare('SELECT config_json FROM integration_connections WHERE id = ?').get('empty') as {
          config_json: string;
        }
      ).config_json,
    ).toBe('{}');
    expect(
      (
        db
          .prepare('SELECT config_json FROM integration_connections WHERE id = ?')
          .get(alreadyContext.id) as { config_json: string }
      ).config_json,
    ).toBe(alreadyEncrypted);
    expect(encryptExistingIntegrationConfigs(db)).toBe(0);
    db.close();
  });
});
