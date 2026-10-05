import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { PlatformSettingsRepository } from '../../domain/repositories/PlatformSettingsRepository';

/** platform_settings: clave → JSON. Solo la usa el hub de administración. */
export class SqlitePlatformSettingsRepository implements PlatformSettingsRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async get(key: string): Promise<string | null> {
    const row = await this.db.queryRow<{ value_json: string }>(
      'SELECT value_json FROM platform_settings WHERE key = ?',
      [key],
    );
    return row ? row.value_json : null;
  }

  public async set(key: string, valueJson: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      [key, valueJson],
    );
  }
}
