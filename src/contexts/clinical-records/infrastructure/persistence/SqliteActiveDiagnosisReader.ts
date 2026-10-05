import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  ActiveDiagnosisReader,
  ActiveDiagnosisSummary,
} from '../../domain/repositories/ActiveDiagnosisReader';

interface ActiveDiagnosisRow {
  patient_id: string;
  cie11_code: string;
  cie11_title: string;
  kind: string | null;
  diagnosed_at: string;
}

function toSummary(row: ActiveDiagnosisRow): ActiveDiagnosisSummary {
  return {
    patientId: row.patient_id,
    cie11Code: row.cie11_code,
    cie11Title: row.cie11_title,
    kind: row.kind === 'formal' ? 'formal' : 'hipotesis',
    diagnosedAt: row.diagnosed_at,
  };
}

/** Diagnóstico activo más reciente por paciente, acotado al dueño de la sesión. */
export class SqliteActiveDiagnosisReader implements ActiveDiagnosisReader {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async latestForPatient(patientId: string): Promise<ActiveDiagnosisSummary | null> {
    const row = await this.db.queryRow<ActiveDiagnosisRow>(
      `SELECT patient_id, cie11_code, cie11_title, kind, diagnosed_at
         FROM diagnoses
         WHERE patient_id = ? AND owner_user_id = ? AND status = 'activo'
         ORDER BY diagnosed_at DESC LIMIT 1`,
      [patientId, this.ownerUserId],
    );
    return row ? toSummary(row) : null;
  }

  public async latestForAllPatients(): Promise<Map<string, ActiveDiagnosisSummary>> {
    const rows = await this.db.query<ActiveDiagnosisRow>(
      // Diagnóstico ACTIVO más reciente por paciente. Antes: GROUP BY patient_id con
      // columnas "desnudas" (cie11_code/title/kind) — SQLite las tolera, pero Postgres
      // lo RECHAZA (42803: no están en el GROUP BY ni agregadas, y patient_id no es la
      // PK). Se reescribe con ROW_NUMBER() (window function que ambos motores soportan):
      // una fila por paciente, la del diagnosed_at más reciente (desempate por id).
      `SELECT patient_id, cie11_code, cie11_title, kind, diagnosed_at
         FROM (
           SELECT patient_id, cie11_code, cie11_title, kind, diagnosed_at,
                  ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY diagnosed_at DESC, id DESC) AS rn
             FROM diagnoses
            WHERE owner_user_id = ? AND status = 'activo'
         ) t
        WHERE rn = 1`,
      [this.ownerUserId],
    );
    const map = new Map<string, ActiveDiagnosisSummary>();
    for (const row of rows) {
      map.set(row.patient_id, toSummary(row));
    }
    return map;
  }
}
