import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { AutomationDeliveryLog } from '../../domain/repositories/AutomationDeliveryLog';

/** Historial de automatizaciones acotado al dueño (owner_user_id) de la sesión. */
export class SqliteAutomationDeliveryLog implements AutomationDeliveryLog {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async wasBirthdayGreetingSentThisYear(patientId: string, year: number): Promise<boolean> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox_messages
          WHERE owner_user_id = ? AND patient_id = ? AND template = 'cumpleanios' AND substr(created_at, 1, 4) = ?`,
      [this.ownerUserId, patientId, String(year)],
    );
    return (row?.n ?? 0) > 0;
  }

  public async wasReactivationSentSince(patientId: string, sinceIso: string): Promise<boolean> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox_messages
          WHERE owner_user_id = ? AND patient_id = ? AND template = 'reactivacion' AND created_at >= ?`,
      [this.ownerUserId, patientId, sinceIso],
    );
    return (row?.n ?? 0) > 0;
  }
}
