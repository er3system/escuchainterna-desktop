import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { InstitutionalPatientReader } from '../../domain/repositories/InstitutionalPatientReader';

export class SqliteInstitutionalPatientReader implements InstitutionalPatientReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async listInstitutionalPatientIds(
    organizationId: string,
    ownerUserId: string,
  ): Promise<string[]> {
    const rows = await this.db.query<{ id: string }>(
      'SELECT id FROM patients WHERE organization_id = ? AND owner_user_id = ?',
      [organizationId, ownerUserId],
    );
    return rows.map((row) => row.id);
  }
}
