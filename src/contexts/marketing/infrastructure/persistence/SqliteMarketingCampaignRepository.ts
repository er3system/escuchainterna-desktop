import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { MarketingCampaign } from '../../domain/MarketingCampaign';
import { MarketingCampaignRepository } from '../../domain/repositories/MarketingCampaignRepository';

interface CampaignRow {
  id: string;
  subject: string;
  body: string;
  audience_json: string;
  sent_at: string | null;
}

/** Campañas de correo acotadas al dueño (owner_user_id) de la sesión. */
export class SqliteMarketingCampaignRepository implements MarketingCampaignRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(campaign: MarketingCampaign): Promise<void> {
    const primitives = campaign.toPrimitives();
    await this.db.execute(
      `INSERT INTO marketing_campaigns (id, subject, body, audience_json, sent_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           subject = excluded.subject,
           body = excluded.body,
           audience_json = excluded.audience_json,
           sent_at = excluded.sent_at
         WHERE marketing_campaigns.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.subject,
        primitives.body,
        JSON.stringify(primitives.audience),
        primitives.sentAt,
        this.ownerUserId,
      ],
    );
  }

  public async listRecent(limit: number): Promise<MarketingCampaign[]> {
    const rows = await this.db.query<CampaignRow>(
      'SELECT * FROM marketing_campaigns WHERE owner_user_id = ? ORDER BY sent_at DESC LIMIT ?',
      [this.ownerUserId, Math.max(1, limit)],
    );
    return rows.map((row) =>
      MarketingCampaign.fromPrimitives({
        id: row.id,
        subject: row.subject,
        body: row.body,
        audience: JSON.parse(row.audience_json || '[]'),
        sentAt: row.sent_at,
      }),
    );
  }
}
