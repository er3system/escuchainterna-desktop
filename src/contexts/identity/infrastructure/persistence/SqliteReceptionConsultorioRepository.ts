import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  ReceptionAssignment,
  ReceptionConsultorioRepository,
  ReceptionScope,
} from '../../domain/repositories/ReceptionConsultorioRepository';

interface Row {
  organization_id: string;
  consultorio_id: string;
}

export class SqliteReceptionConsultorioRepository implements ReceptionConsultorioRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async setConsultorios(
    assistantUserId: string,
    organizationId: string,
    consultorioIds: string[],
  ): Promise<void> {
    const unique = [...new Set(consultorioIds.filter(Boolean))];
    const now = new Date().toISOString();
    await this.db.transaction(async () => {
      // Reemplazo del conjunto: se borra TODO lo de esta recepción (en cualquier org, para
      // no dejar filas colgando si cambia de org) y se reinserta el conjunto nuevo.
      await this.db.execute('DELETE FROM reception_consultorios WHERE assistant_user_id = ?', [
        assistantUserId,
      ]);
      for (const consultorioId of unique) {
        await this.db.execute(
          `INSERT INTO reception_consultorios (id, assistant_user_id, organization_id, consultorio_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), assistantUserId, organizationId, consultorioId, now],
        );
      }
    });
  }

  public async scopeFor(assistantUserId: string): Promise<ReceptionScope | null> {
    const rows = await this.db.query<Row>(
      'SELECT organization_id, consultorio_id FROM reception_consultorios WHERE assistant_user_id = ?',
      [assistantUserId],
    );
    if (rows.length === 0) return null;
    return {
      organizationId: rows[0].organization_id,
      consultorioIds: rows.map((row) => row.consultorio_id),
    };
  }

  public async listByOrganization(organizationId: string): Promise<ReceptionAssignment[]> {
    const rows = await this.db.query<{ assistant_user_id: string; consultorio_id: string }>(
      'SELECT assistant_user_id, consultorio_id FROM reception_consultorios WHERE organization_id = ?',
      [organizationId],
    );
    const byUser = new Map<string, string[]>();
    for (const row of rows) {
      const list = byUser.get(row.assistant_user_id) ?? [];
      list.push(row.consultorio_id);
      byUser.set(row.assistant_user_id, list);
    }
    return [...byUser.entries()].map(([assistantUserId, consultorioIds]) => ({
      assistantUserId,
      consultorioIds,
    }));
  }
}
