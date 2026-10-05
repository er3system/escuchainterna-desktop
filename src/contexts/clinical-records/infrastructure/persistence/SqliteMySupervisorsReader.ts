import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { sameConsultorioSql } from '@/shared/infrastructure/persistence/consultorioSql';

export interface SupervisorOption {
  supervisorUserId: string;
  fullName: string;
  email: string;
  organizationId: string;
}

interface SupervisorRow {
  supervisor_user_id: string;
  organization_id: string;
  email: string;
  full_name: string;
}

/**
 * Supervisores ACTIVOS de un usuario (vínculos vigentes donde es el supervisado),
 * para ofrecerle a quién pedir la co-firma. Solo vínculos `revoked_at IS NULL` y con
 * el supervisor con cuenta activa (mismo criterio que el read-path de supervisión, v28).
 */
export class SqliteMySupervisorsReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async list(supervisedUserId: string): Promise<SupervisorOption[]> {
    const rows = await this.db.query<SupervisorRow>(
      `SELECT l.supervisor_user_id, l.organization_id, u.email,
                COALESCE(p.full_name, '') AS full_name
           FROM supervision_links l
           JOIN users u ON u.id = l.supervisor_user_id
           LEFT JOIN practitioner_profile p ON p.user_id = l.supervisor_user_id
          WHERE l.supervised_user_id = ? AND l.revoked_at IS NULL AND u.status = 'activo'
            AND ${sameConsultorioSql('l.organization_id', 'l.supervisor_user_id', 'l.supervised_user_id')}
          ORDER BY l.created_at ASC`,
      [supervisedUserId],
    );
    return rows.map((row) => ({
      supervisorUserId: row.supervisor_user_id,
      fullName: row.full_name,
      email: row.email,
      organizationId: row.organization_id,
    }));
  }

  /** ¿Este supervisor es uno de mis supervisores activos? Devuelve la opción o null. */
  public async find(
    supervisedUserId: string,
    supervisorUserId: string,
  ): Promise<SupervisorOption | null> {
    const options = await this.list(supervisedUserId);
    return options.find((option) => option.supervisorUserId === supervisorUserId) ?? null;
  }
}
