import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Consultorio } from '../../domain/Consultorio';
import type { ConsultorioRepository } from '../../domain/repositories/ConsultorioRepository';

interface ConsultorioRow {
  id: string;
  organization_id: string;
  name: string;
  archived: number;
  created_at: string;
}

function toAggregate(row: ConsultorioRow): Consultorio {
  return Consultorio.fromPrimitives({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    archived: row.archived === 1,
    createdAt: row.created_at,
  });
}

export class SqliteConsultorioRepository implements ConsultorioRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(consultorio: Consultorio): Promise<void> {
    const primitives = consultorio.toPrimitives();
    await this.db.execute(
      `INSERT INTO consultorios (id, organization_id, name, created_at, archived)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           archived = excluded.archived`,
      [
        primitives.id,
        primitives.organizationId,
        primitives.name,
        primitives.createdAt,
        primitives.archived ? 1 : 0,
      ],
    );
  }

  public async findById(id: string): Promise<Consultorio | null> {
    const row = await this.db.queryRow<ConsultorioRow>('SELECT * FROM consultorios WHERE id = ?', [id]);
    return row ? toAggregate(row) : null;
  }

  public async listByOrganization(organizationId: string): Promise<Consultorio[]> {
    const rows = await this.db.query<ConsultorioRow>(
      'SELECT * FROM consultorios WHERE organization_id = ? AND archived = 0 ORDER BY created_at ASC',
      [organizationId],
    );
    return rows.map(toAggregate);
  }

  public async findByIdInOrganization(id: string, organizationId: string): Promise<Consultorio | null> {
    const row = await this.db.queryRow<ConsultorioRow>(
      'SELECT * FROM consultorios WHERE id = ? AND organization_id = ?',
      [id, organizationId],
    );
    return row ? toAggregate(row) : null;
  }
}
