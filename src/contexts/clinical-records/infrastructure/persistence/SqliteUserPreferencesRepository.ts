import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Almacén clave-valor de preferencias del usuario, acotado por `owner_user_id`
 * (regla de oro v2). Tabla `user_preferences` (migración v14). Los valores son
 * preferencias de configuración, NO contenido clínico, así que van en claro.
 */
export class SqliteUserPreferencesRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async get(key: string): Promise<string | null> {
    const row = await this.db.queryRow<{ value: string }>(
      'SELECT value FROM user_preferences WHERE owner_user_id = ? AND key = ?',
      [this.ownerUserId, key],
    );
    return row ? row.value : null;
  }

  public async set(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO user_preferences (owner_user_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(owner_user_id, key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
      [this.ownerUserId, key, value, new Date().toISOString()],
    );
  }

  public async delete(key: string): Promise<void> {
    await this.db.execute('DELETE FROM user_preferences WHERE owner_user_id = ? AND key = ?', [
      this.ownerUserId,
      key,
    ]);
  }
}
