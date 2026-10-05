import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { portfolioCode, type PortfolioCase } from '../../domain/portfolio';

interface AggRow {
  pid: string;
}

/**
 * Arma el portafolio pseudonimizado de un miembro (§3.4): SUS casos (donde fue
 * tratante, actuales o ya reasignados), con datos ESTRUCTURADOS y sin identificar al
 * paciente. Lee el contenido clínico por owner_user_id = miembro (lo creó él), así que
 * funciona antes y después del offboarding. No expone nombres, documento ni texto libre.
 */
export class SqlitePortfolioReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  /** Ids de los pacientes del portafolio (para trazar el export en la bitácora). */
  public async casePatientIds(organizationId: string, memberUserId: string): Promise<string[]> {
    const rows = await this.db.query<AggRow>(
      `SELECT DISTINCT pid FROM (
           SELECT id AS pid FROM patients WHERE owner_user_id = ? AND organization_id = ?
           UNION
           SELECT patient_id AS pid FROM patient_assignments WHERE tratante_user_id = ? AND organization_id = ?
         )`,
      [memberUserId, organizationId, memberUserId, organizationId],
    );
    return rows.map((row) => row.pid);
  }

  public async build(organizationId: string, memberUserId: string): Promise<PortfolioCase[]> {
    // Casos del miembro: los que posee hoy + los que tuvo asignados (ya reasignados).
    const pids = await this.casePatientIds(organizationId, memberUserId);

    const cases: PortfolioCase[] = [];
    // for..of + await (NUNCA forEach, que no espera → promesas colgadas con datos vacíos).
    let index = 0;
    for (const pid of pids) {
      const approachRow = await this.db.queryRow<{ title: string }>(
        `SELECT title FROM clinical_records
            WHERE owner_user_id = ? AND patient_id = ? AND kind = 'historia'
            ORDER BY created_at ASC LIMIT 1`,
        [memberUserId, pid],
      );

      const sessionAgg = (await this.db.queryRow<{
        n: number;
        first_at: string | null;
        last_at: string | null;
      }>(
        `SELECT COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at
             FROM session_notes WHERE owner_user_id = ? AND patient_id = ?`,
        [memberUserId, pid],
      ))!;

      const diagnosisRows = await this.db.query<{ cie11_code: string; cie11_title: string }>(
        `SELECT cie11_code, cie11_title FROM diagnoses
            WHERE owner_user_id = ? AND patient_id = ? ORDER BY diagnosed_at ASC`,
        [memberUserId, pid],
      );

      cases.push({
        code: portfolioCode(index),
        approach: approachRow?.title ?? '',
        sessionCount: sessionAgg.n,
        diagnoses: diagnosisRows.map((d) => `${d.cie11_code} — ${d.cie11_title}`),
        firstDate: sessionAgg.first_at,
        lastDate: sessionAgg.last_at,
      });
      index += 1;
    }

    return cases;
  }
}
