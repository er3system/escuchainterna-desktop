import { randomUUID } from 'node:crypto';
import type { UUID } from '@haskou/value-objects';
import type { PersonalProviderRepository } from '../../domain/repositories/PersonalProviderRepository';
import type { PersonalProviderCredentials } from '../../domain/value-objects/PersonalProviderCredentials';
import { isPersonalProvider, type PersonalProviderName } from '../../domain/personalProviders';
import { encryptIntegrationConfig, decryptIntegrationConfig } from '@/shared/infrastructure/crypto/IntegrationConfigEncryption';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';

export interface PersonalProviderConfiguration { provider: PersonalProviderName; api_key: string; model: string; sender: string; authorized: string }
export class SqlitePersonalProviderRepository implements PersonalProviderRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}
  public async save(owner: UUID, credentials: PersonalProviderCredentials): Promise<void> {
    const config = credentials.toPrimitives();
    const ownerUserId = owner.toString();
    await this.db.transaction(async () => {
      const id = (await this.db.queryRow<{ id: string }>('SELECT id FROM integration_connections WHERE owner_user_id = ? AND provider = ?', [ownerUserId, config.provider]))?.id ?? randomUUID();
      if (credentials.isAi()) await this.db.execute("UPDATE integration_connections SET status = 'desconectado' WHERE owner_user_id = ? AND provider IN ('openai', 'anthropic')", [ownerUserId]);
      const encrypted = encryptIntegrationConfig(config, { id, provider: config.provider, ownerUserId });
      await this.db.execute(`INSERT INTO integration_connections (id, provider, owner_user_id, status, config_json, connected_at)
        VALUES (?, ?, ?, 'conectado', ?, ?) ON CONFLICT(provider, owner_user_id) DO UPDATE SET status = 'conectado', config_json = excluded.config_json, connected_at = excluded.connected_at`,
        [id, config.provider, ownerUserId, encrypted, new Date().toISOString()]);
    });
  }
  public async disconnect(owner: UUID, provider: PersonalProviderName): Promise<void> {
    await this.db.execute("UPDATE integration_connections SET status = 'desconectado', config_json = '{}', connected_at = NULL WHERE owner_user_id = ? AND provider = ?", [owner.toString(), provider]);
  }
  /** Solo servidor: nunca serializar este resultado a componentes cliente. */
  public async find(ownerUserId: string, provider: PersonalProviderName): Promise<PersonalProviderConfiguration | null> {
    const row = await this.db.queryRow<{ id: string; config_json: string }>("SELECT id, config_json FROM integration_connections WHERE owner_user_id = ? AND provider = ? AND status = 'conectado'", [ownerUserId, provider]);
    if (!row) return null;
    try {
      const config = decryptIntegrationConfig(row.config_json, { id: row.id, provider, ownerUserId });
      if (!config.api_key || config.authorized !== 'true' || !isPersonalProvider(provider)) return null;
      return { provider, api_key: config.api_key, model: config.model ?? '', sender: config.sender ?? '', authorized: 'true' };
    } catch { return null; }
  }
  public async activeAi(ownerUserId: string): Promise<PersonalProviderConfiguration | null> {
    return await this.find(ownerUserId, 'openai') ?? await this.find(ownerUserId, 'anthropic');
  }
}
