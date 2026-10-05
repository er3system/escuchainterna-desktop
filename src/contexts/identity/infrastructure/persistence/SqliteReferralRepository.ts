import { randomUUID, randomInt } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  ReferralActivation,
  ReferralRepository,
} from '../../domain/repositories/ReferralRepository';

/** Alfabeto legible: sin 0/O ni 1/I/L para dictarlo sin ambigüedad. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export class SqliteReferralRepository implements ReferralRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.db.queryRow<{ code: string }>(
      'SELECT code FROM referral_codes WHERE user_id = ?',
      [userId],
    );
    if (existing) return existing.code;

    // El código es UNIQUE: ante una colisión (probabilidad ínfima) se reintenta.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      try {
        await this.db.execute(
          'INSERT INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)',
          [userId, code, new Date().toISOString()],
        );
        return code;
      } catch {
        // TODO(0d): la clase de error UNIQUE de pg != sqlite
        // Colisión de código o carrera por user_id: relee y reintenta.
        const raced = await this.db.queryRow<{ code: string }>(
          'SELECT code FROM referral_codes WHERE user_id = ?',
          [userId],
        );
        if (raced) return raced.code;
      }
    }
    throw new Error('No se pudo generar un código de referido único.');
  }

  public async findReferrerByCode(code: string): Promise<string | null> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;
    const row = await this.db.queryRow<{ user_id: string }>(
      'SELECT user_id FROM referral_codes WHERE code = ?',
      [normalized],
    );
    return row?.user_id ?? null;
  }

  public async registerReferral(referrerUserId: string, referredUserId: string): Promise<void> {
    if (referrerUserId === referredUserId) return;
    await this.db.execute(
      `INSERT INTO referrals (id, referrer_user_id, referred_user_id, status, created_at)
         VALUES (?, ?, ?, 'registrado', ?)
         ON CONFLICT DO NOTHING`,
      [randomUUID(), referrerUserId, referredUserId, new Date().toISOString()],
    );
  }

  public async activateForReferredUser(referredUserId: string): Promise<ReferralActivation | null> {
    const row = await this.db.queryRow<{
      id: string;
      referrer_user_id: string;
      referred_name: string;
    }>(
      `SELECT r.id, r.referrer_user_id,
                COALESCE(NULLIF(p.full_name, ''), u.email) AS referred_name
           FROM referrals r
           JOIN users u ON u.id = r.referred_user_id
           LEFT JOIN practitioner_profile p ON p.user_id = r.referred_user_id
          WHERE r.referred_user_id = ? AND r.status = 'registrado'`,
      [referredUserId],
    );
    if (!row) return null;

    await this.db.execute(`UPDATE referrals SET status = 'activo', activated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      row.id,
    ]);
    return {
      referralId: row.id,
      referrerUserId: row.referrer_user_id,
      referredDisplayName: row.referred_name,
    };
  }

  public async countActiveFor(referrerUserId: string): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM referrals WHERE referrer_user_id = ? AND status = 'activo'`,
      [referrerUserId],
    );
    return row?.n ?? 0;
  }

  public async countRegisteredFor(referrerUserId: string): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM referrals WHERE referrer_user_id = ? AND status = 'registrado'`,
      [referrerUserId],
    );
    return row?.n ?? 0;
  }
}
