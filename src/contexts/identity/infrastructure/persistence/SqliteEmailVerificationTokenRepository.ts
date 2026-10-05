import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { EmailVerificationToken } from '../../domain/EmailVerificationToken';
import type { EmailVerificationTokenRepository } from '../../domain/repositories/EmailVerificationTokenRepository';

interface TokenRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export class SqliteEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(token: EmailVerificationToken): Promise<void> {
    const primitives = token.toPrimitives();
    await this.db.execute(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET used = excluded.used`,
      [
        primitives.id,
        primitives.userId,
        primitives.token,
        primitives.expiresAt,
        primitives.used ? 1 : 0,
        primitives.createdAt,
      ],
    );
  }

  public async findByToken(tokenValue: string): Promise<EmailVerificationToken | null> {
    const row = await this.db.queryRow<TokenRow>(
      'SELECT * FROM email_verification_tokens WHERE token = ?',
      [tokenValue],
    );
    if (!row) return null;
    return EmailVerificationToken.fromPrimitives({
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      used: row.used === 1,
      createdAt: row.created_at,
    });
  }
}
