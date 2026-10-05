import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { FamilyMap } from '../../domain/FamilyMap';
import { normalizeFamilyMapData } from '../../domain/value-objects/familyMapElements';
import type { FamilyMapRepository } from '../../domain/repositories/FamilyMapRepository';

interface FamilyMapRow {
  id: string;
  patient_id: string;
  title: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

function toAggregate(row: FamilyMapRow): FamilyMap {
  let data: unknown = {};
  try {
    data = JSON.parse(row.data_json);
  } catch {
    data = {};
  }
  return FamilyMap.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    data: normalizeFamilyMapData(data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Mapas familiares (genogramas) acotados al dueño de la sesión. */
export class SqliteFamilyMapRepository implements FamilyMapRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(map: FamilyMap): Promise<void> {
    const primitives = map.toPrimitives();
    await this.db.execute(
      `INSERT INTO family_maps (id, patient_id, owner_user_id, title, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           data_json = excluded.data_json,
           updated_at = excluded.updated_at
         WHERE family_maps.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        this.ownerUserId,
        primitives.title,
        JSON.stringify(primitives.data),
        primitives.createdAt,
        primitives.updatedAt,
      ],
    );
  }

  public async findById(id: string): Promise<FamilyMap | null> {
    const row = await this.db.queryRow<FamilyMapRow>(
      'SELECT * FROM family_maps WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<FamilyMap[]> {
    const rows = await this.db.query<FamilyMapRow>(
      'SELECT * FROM family_maps WHERE patient_id = ? AND owner_user_id = ? ORDER BY updated_at DESC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM family_maps WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
