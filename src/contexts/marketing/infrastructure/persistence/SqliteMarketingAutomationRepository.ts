import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  type AutomationKind,
  MARKETING_AUTOMATION_KINDS,
  MarketingAutomation,
} from '../../domain/MarketingAutomation';
import { MarketingAutomationRepository } from '../../domain/repositories/MarketingAutomationRepository';

interface AutomationRow {
  id: string;
  kind: AutomationKind;
  enabled: number;
  interval_months: number | null;
  subject: string;
  body: string;
}

export class SqliteMarketingAutomationRepository implements MarketingAutomationRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async listAll(): Promise<MarketingAutomation[]> {
    const rows = await this.db.query<AutomationRow>(
      'SELECT * FROM marketing_automations WHERE owner_user_id = ? ORDER BY kind',
      [this.ownerUserId],
    );
    const byKind = new Map(rows.map((row) => [row.kind, row]));
    return MARKETING_AUTOMATION_KINDS.map((kind) => {
      const row = byKind.get(kind);
      return row ? this.hydrate(row) : this.defaultFor(kind);
    });
  }

  public async findByKind(kind: AutomationKind): Promise<MarketingAutomation> {
    const row = await this.db.queryRow<AutomationRow>(
      'SELECT * FROM marketing_automations WHERE owner_user_id = ? AND kind = ?',
      [this.ownerUserId, kind],
    );
    return row ? this.hydrate(row) : this.defaultFor(kind);
  }

  public async save(automation: MarketingAutomation): Promise<void> {
    const primitives = automation.toPrimitives();
    await this.db.execute(
      `INSERT INTO marketing_automations
         (id, owner_user_id, kind, enabled, interval_months, subject, body)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_user_id, kind) DO UPDATE SET
         enabled = excluded.enabled,
         interval_months = excluded.interval_months,
         subject = excluded.subject,
         body = excluded.body`,
      [
        primitives.id,
        this.ownerUserId,
        primitives.kind,
        primitives.enabled ? 1 : 0,
        primitives.intervalMonths,
        primitives.subject,
        primitives.body,
      ],
    );
  }

  private defaultFor(kind: AutomationKind): MarketingAutomation {
    return MarketingAutomation.defaultFor(
      `${this.ownerUserId}:marketing-automation:${kind}`,
      kind,
    );
  }

  private hydrate(row: AutomationRow): MarketingAutomation {
    return MarketingAutomation.fromPrimitives({
      id: row.id,
      kind: row.kind,
      enabled: row.enabled === 1,
      intervalMonths: row.interval_months,
      subject: row.subject,
      body: row.body,
    });
  }
}
