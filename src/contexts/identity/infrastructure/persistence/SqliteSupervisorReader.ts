import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { sameConsultorioSql } from '@/shared/infrastructure/persistence/consultorioSql';

/**
 * Lee el supervisor (profesor) ACTIVO de un usuario supervisado dentro de una
 * organización, a partir de supervision_links. Lo usa la capa de asignación
 * institucional (§1.3, §3.2): al dar de alta un paciente se anota el supervisor
 * del tratante; en el offboarding la cartera pasa al supervisor activo.
 *
 * AISLAMIENTO DE CONSULTORIO (consultorios-spec §3, F4): todas las consultas exigen,
 * además, que supervisor y supervisado compartan consultorio (o que alguno no tenga,
 * NULL). Se evalúa SIEMPRE con el `organization_id` del propio vínculo, así un vínculo
 * cross-consultorio no concede nada (lectura, co-firma ni herencia de cartera) aunque
 * la fila exista. Una org sin consultorios (todo NULL) se comporta como antes.
 */
// Condición reutilizable: supervisor y supervisado del vínculo `l` mismo consultorio.
const SAME_CONSULTORIO = sameConsultorioSql(
  'l.organization_id',
  'l.supervisor_user_id',
  'l.supervised_user_id',
);

export class SqliteSupervisorReader {
  /**
   * userId del supervisor del `supervisedUserId` cuyo vínculo está vigente y cuya
   * cuenta sigue activa (status='activo'). null si no tiene supervisor activo.
   */
  public async findActiveSupervisor(
    supervisedUserId: string,
    organizationId?: string,
  ): Promise<string | null> {
    const params: string[] = [supervisedUserId];
    let orgFilter = '';
    if (organizationId) {
      orgFilter = ' AND l.organization_id = ?';
      params.push(organizationId);
    }
    const row = await getDatabaseAdapter().queryRow<{ supervisor: string }>(
      `SELECT l.supervisor_user_id AS supervisor
         FROM supervision_links l
         JOIN users u ON u.id = l.supervisor_user_id
        WHERE l.supervised_user_id = ?${orgFilter} AND u.status = 'activo' AND l.revoked_at IS NULL
          AND ${SAME_CONSULTORIO}
        ORDER BY l.created_at ASC LIMIT 1`,
      params,
    );
    return row?.supervisor ?? null;
  }

  /**
   * ¿`supervisorUserId` supervisa a `supervisedUserId`? Si se pasa `organizationId`,
   * el vínculo debe ser DE esa organización (defensa en profundidad: la supervisión
   * relevante para la cobertura es la de la misma institución, §2.2 'intermedio').
   */
  public async supervises(
    supervisorUserId: string,
    supervisedUserId: string,
    organizationId?: string,
  ): Promise<boolean> {
    const params: string[] = [supervisorUserId, supervisedUserId];
    let orgFilter = '';
    if (organizationId) {
      orgFilter = ' AND l.organization_id = ?';
      params.push(organizationId);
    }
    const row = await getDatabaseAdapter().queryRow<{ hit: number }>(
      `SELECT 1 AS hit FROM supervision_links l
        WHERE l.supervisor_user_id = ? AND l.supervised_user_id = ?${orgFilter} AND l.revoked_at IS NULL
          AND ${SAME_CONSULTORIO} LIMIT 1`,
      params,
    );
    return row !== null;
  }

  /**
   * Como `supervises()` pero EXIGE además que el supervisado siga con cuenta ACTIVA
   * (mismo criterio fail-closed que el read-path de supervisión, v28). Úsalo cuando la
   * supervisión habilita LEER o ESCRIBIR el expediente del supervisado (co-firma): no
   * se firma ni se lee el expediente de una cuenta que la institución inhabilitó. (La
   * suspensión no revoca el vínculo, así que `supervises()` por sí solo no basta.)
   */
  public async supervisesActive(
    supervisorUserId: string,
    supervisedUserId: string,
    organizationId?: string,
  ): Promise<boolean> {
    const params: string[] = [supervisorUserId, supervisedUserId];
    let orgFilter = '';
    if (organizationId) {
      orgFilter = ' AND l.organization_id = ?';
      params.push(organizationId);
    }
    const row = await getDatabaseAdapter().queryRow<{ hit: number }>(
      `SELECT 1 AS hit FROM supervision_links l
         JOIN users u ON u.id = l.supervised_user_id AND u.status = 'activo'
        WHERE l.supervisor_user_id = ? AND l.supervised_user_id = ?${orgFilter} AND l.revoked_at IS NULL
          AND ${SAME_CONSULTORIO} LIMIT 1`,
      params,
    );
    return row !== null;
  }
}
