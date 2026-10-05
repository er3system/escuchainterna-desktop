import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { PatientTagsRepository } from '../../domain/repositories/PatientTagsRepository';

/** Etiquetas de pacientes acotadas al dueño (owner_user_id) de la sesión. */
export class SqlitePatientTagsRepository implements PatientTagsRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findTags(patientId: string): Promise<string[] | null> {
    const row = await this.db.queryRow<{ tags_json: string }>(
      'SELECT tags_json FROM patients WHERE id = ? AND owner_user_id = ?',
      [patientId, this.ownerUserId],
    );
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.tags_json || '[]');
      return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch {
      return [];
    }
  }

  public async saveTags(patientId: string, tags: string[]): Promise<void> {
    await this.db.execute('UPDATE patients SET tags_json = ? WHERE id = ? AND owner_user_id = ?', [
      JSON.stringify(tags),
      patientId,
      this.ownerUserId,
    ]);
  }
}
