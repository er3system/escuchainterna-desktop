import { randomUUID } from 'node:crypto';
import type { UUID } from '@haskou/value-objects';
import { GoogleCalendarConnection } from '../../domain/GoogleCalendarConnection';
import type { GoogleCalendarConnectionRepository } from '../../domain/repositories/GoogleCalendarConnectionRepository';
import { decryptIntegrationConfig, encryptIntegrationConfig } from '@/shared/infrastructure/crypto/IntegrationConfigEncryption';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
export class SqliteGoogleCalendarConnectionRepository implements GoogleCalendarConnectionRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}
  public async find(owner: UUID): Promise<GoogleCalendarConnection | null> {
    const ownerUserId = owner.toString();
    const row = await this.db.queryRow<{ id: string; config_json: string }>("SELECT id, config_json FROM integration_connections WHERE owner_user_id = ? AND provider = 'google_calendar' AND status = 'conectado'", [ownerUserId]);
    if (!row) return null;
    try { return GoogleCalendarConnection.fromPrimitives(decryptIntegrationConfig(row.config_json, { id: row.id, provider: 'google_calendar', ownerUserId })); } catch { return null; }
  }
  public async save(owner: UUID, connection: GoogleCalendarConnection): Promise<void> {
    const ownerUserId = owner.toString();
    await this.db.transaction(async () => {
      const id = (await this.db.queryRow<{ id: string }>("SELECT id FROM integration_connections WHERE owner_user_id = ? AND provider = 'google_calendar'", [ownerUserId]))?.id ?? randomUUID();
      const encrypted = encryptIntegrationConfig(connection.toPrimitives(), { id, provider: 'google_calendar', ownerUserId });
      await this.db.execute("INSERT INTO integration_connections (id, provider, owner_user_id, status, config_json, connected_at) VALUES (?, 'google_calendar', ?, 'conectado', ?, ?) ON CONFLICT(provider, owner_user_id) DO UPDATE SET status = 'conectado', config_json = excluded.config_json, connected_at = excluded.connected_at", [id, ownerUserId, encrypted, new Date().toISOString()]);
    });
  }
  public async disconnect(owner: UUID): Promise<void> { await this.db.execute("UPDATE integration_connections SET status = 'desconectado', config_json = '{}', connected_at = NULL WHERE owner_user_id = ? AND provider = 'google_calendar'", [owner.toString()]); }
  public async ownerIsActive(owner: UUID): Promise<boolean> { return Boolean(await this.db.queryRow("SELECT id FROM users WHERE id = ? AND status != 'suspendido' AND role != 'assistant'", [owner.toString()])); }
}
