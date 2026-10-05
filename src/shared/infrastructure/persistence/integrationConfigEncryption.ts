import type { DatabaseSync } from 'node:sqlite';
import {
  decryptIntegrationConfig,
  encryptIntegrationConfig,
  integrationConfigKeyId,
  isEncryptedIntegrationConfig,
  type IntegrationConfigContext,
} from '../crypto/IntegrationConfigEncryption';
import type { DatabaseAdapter } from './DatabaseAdapter';

const MARKER_KEY = 'integration_config_encryption';
const CURRENT_VERSION = 1;

interface IntegrationConfigRow {
  id: string;
  provider: string;
  owner_user_id: string;
  config_json: string;
}

function contextOf(row: IntegrationConfigRow): IntegrationConfigContext {
  return { id: row.id, provider: row.provider, ownerUserId: row.owner_user_id };
}

function encryptedReplacement(row: IntegrationConfigRow): string | null {
  const context = contextOf(row);
  const config = decryptIntegrationConfig(row.config_json, context);
  if (Object.keys(config).length === 0) return row.config_json === '{}' ? null : '{}';
  if (isEncryptedIntegrationConfig(row.config_json)) return null;
  return encryptIntegrationConfig(config, context);
}

function marker(rows: number): string {
  return JSON.stringify({
    version: CURRENT_VERSION,
    activeKeyId: process.env.INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID?.trim() || 'data-v1',
    encryptedAt: new Date().toISOString(),
    rows,
  });
}

/** Pase idempotente para SQLite local. Valida también los envelopes existentes. */
export function encryptExistingIntegrationConfigs(db: DatabaseSync): number {
  const rows = db
    .prepare('SELECT id, provider, owner_user_id, config_json FROM integration_connections')
    .all() as unknown as IntegrationConfigRow[];
  let encrypted = 0;
  db.exec('BEGIN');
  try {
    const update = db.prepare(
      'UPDATE integration_connections SET config_json = ? WHERE id = ? AND config_json = ?',
    );
    for (const row of rows) {
      const replacement = encryptedReplacement(row);
      if (replacement === null) continue;
      update.run(replacement, row.id, row.config_json);
      if (isEncryptedIntegrationConfig(replacement)) encrypted += 1;
    }
    db.prepare(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(MARKER_KEY, marker(encrypted));
    db.exec('COMMIT');
    return encrypted;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Pase portable para PostgreSQL, ejecutado desde la CLI después del deploy. */
export async function encryptExistingIntegrationConfigsOnAdapter(
  db: DatabaseAdapter,
): Promise<number> {
  return db.transaction(async () => {
    const rows = await db.query<IntegrationConfigRow>(
      'SELECT id, provider, owner_user_id, config_json FROM integration_connections',
    );
    let encrypted = 0;
    for (const row of rows) {
      const replacement = encryptedReplacement(row);
      if (replacement === null) continue;
      await db.execute(
        'UPDATE integration_connections SET config_json = ? WHERE id = ? AND config_json = ?',
        [replacement, row.id, row.config_json],
      );
      if (isEncryptedIntegrationConfig(replacement)) encrypted += 1;
    }
    const remaining = await db.queryRow<{ total: number }>(
      `SELECT COUNT(*) AS total FROM integration_connections
        WHERE config_json NOT IN ('', '{}') AND config_json NOT LIKE 'enc:cfg:v1:%'`,
    );
    if ((remaining?.total ?? 0) !== 0) {
      throw new Error('Quedaron configuraciones de integración sin cifrar; se revirtió el pase.');
    }
    await db.execute(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      [MARKER_KEY, marker(encrypted)],
    );
    return encrypted;
  });
}

export function storedIntegrationConfigKeyId(stored: string): string | null {
  return integrationConfigKeyId(stored);
}
