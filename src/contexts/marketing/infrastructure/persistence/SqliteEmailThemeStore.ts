import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { DEFAULT_EMAIL_THEME } from '@/shared/infrastructure/email-themes/emailThemes';
import { EmailThemeStore } from '../../domain/repositories/EmailThemeStore';

/** Tema de correo del profesional en practitioner_profile.email_theme. */
export class SqliteEmailThemeStore implements EmailThemeStore {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async current(): Promise<string> {
    const row = await this.db.queryRow<{ email_theme: string }>(
      `SELECT email_theme FROM practitioner_profile WHERE user_id = ? LIMIT 1`,
      [this.ownerUserId],
    );
    return row?.email_theme || DEFAULT_EMAIL_THEME;
  }

  public async save(theme: string): Promise<void> {
    await this.db.execute(`UPDATE practitioner_profile SET email_theme = ? WHERE user_id = ?`, [
      theme,
      this.ownerUserId,
    ]);
  }
}
