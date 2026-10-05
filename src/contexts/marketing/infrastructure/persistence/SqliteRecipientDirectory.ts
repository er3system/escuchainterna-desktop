import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  MarketingRecipient,
  RecipientDirectory,
  SegmentationRecipient,
} from '../../domain/repositories/RecipientDirectory';

interface RecipientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string | null;
  last_session_at: string | null;
}

interface SegmentationRow extends RecipientRow {
  gender: string;
  archived: number;
  tags_json: string;
}

const BASE_SELECT = `
  SELECT p.id, p.full_name, p.email, p.phone, p.birth_date,
         (SELECT MAX(b.start_at) FROM bookings b
           WHERE b.patient_id = p.id AND b.status != 'cancelada') AS last_session_at
    FROM patients p
   WHERE p.archived = 0 AND p.owner_user_id = ?`;

/** Destinatarios de marketing acotados al dueño (owner_user_id) de la sesión. */
export class SqliteRecipientDirectory implements RecipientDirectory {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async listAll(): Promise<MarketingRecipient[]> {
    const rows = await this.db.query<RecipientRow>(`${BASE_SELECT} ORDER BY LOWER(p.full_name)`, [
      this.ownerUserId,
    ]);
    return rows.map((row) => this.hydrate(row));
  }

  public async search(text: string): Promise<MarketingRecipient[]> {
    const term = text.trim();
    if (!term) return this.listAll();
    const like = `%${term}%`;
    const rows = await this.db.query<RecipientRow>(
      `${BASE_SELECT} AND (p.full_name LIKE ? OR p.email LIKE ?) ORDER BY LOWER(p.full_name)`,
      [this.ownerUserId, like, like],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async findByIds(ids: string[]): Promise<MarketingRecipient[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    // Sin filtro de archivado: los ids vienen de una selección explícita del
    // profesional (p. ej. el filtro "estado: archivados" del compositor).
    const rows = await this.db.query<RecipientRow>(
      `SELECT p.id, p.full_name, p.email, p.phone, p.birth_date,
                (SELECT MAX(b.start_at) FROM bookings b
                  WHERE b.patient_id = p.id AND b.status != 'cancelada') AS last_session_at
           FROM patients p
          WHERE p.owner_user_id = ? AND p.id IN (${placeholders})
          ORDER BY LOWER(p.full_name)`,
      [this.ownerUserId, ...ids],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async listWithBirthdayOn(month: number, day: number): Promise<MarketingRecipient[]> {
    const rows = await this.db.query<RecipientRow>(
      `${BASE_SELECT}
           AND p.birth_date IS NOT NULL
           AND CAST(substr(p.birth_date, 6, 2) AS INTEGER) = ?
           AND CAST(substr(p.birth_date, 9, 2) AS INTEGER) = ?`,
      [this.ownerUserId, month, day],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async listInactiveSince(cutoffIso: string): Promise<MarketingRecipient[]> {
    const rows = await this.db.query<RecipientRow>(
      `SELECT * FROM (${BASE_SELECT}) AS recipients
          WHERE recipients.last_session_at IS NOT NULL
            AND recipients.last_session_at < ?`,
      [this.ownerUserId, cutoffIso],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async listForSegmentation(): Promise<SegmentationRecipient[]> {
    const rows = await this.db.query<SegmentationRow>(
      `SELECT p.id, p.full_name, p.email, p.phone, p.birth_date, p.gender, p.archived, p.tags_json,
                (SELECT MAX(b.start_at) FROM bookings b
                  WHERE b.patient_id = p.id AND b.status != 'cancelada') AS last_session_at
           FROM patients p
          WHERE p.owner_user_id = ?
          ORDER BY LOWER(p.full_name)`,
      [this.ownerUserId],
    );
    return rows.map((row) => ({
      ...this.hydrate(row),
      gender: row.gender ?? '',
      archived: row.archived === 1,
      tags: SqliteRecipientDirectory.parseTags(row.tags_json),
    }));
  }

  private static parseTags(tagsJson: string): string[] {
    try {
      const parsed = JSON.parse(tagsJson || '[]');
      return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch {
      return [];
    }
  }

  private hydrate(row: RecipientRow): MarketingRecipient {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      birthDate: row.birth_date,
      lastSessionAt: row.last_session_at,
    };
  }
}
