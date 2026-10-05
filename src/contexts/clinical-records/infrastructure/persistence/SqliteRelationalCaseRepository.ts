import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import {
  RelationalCase,
  type RelationalCaseKind,
  type RelationalCaseStatus,
  type SecretsPolicy,
} from '../../domain/RelationalCase';
import { parseCaseProfile } from '../../domain/value-objects/caseProfile';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

interface RelationalCaseRow {
  id: string;
  owner_user_id: string;
  kind: string;
  title: string;
  status: string;
  secrets_policy: string;
  secrets_policy_set_at: string | null;
  contraindication_reason: string;
  profile_json: string | null;
  created_at: string;
  updated_at: string;
}

function toAggregate(row: RelationalCaseRow): RelationalCase {
  return RelationalCase.fromPrimitives({
    id: row.id,
    ownerUserId: row.owner_user_id,
    kind: (row.kind as RelationalCaseKind) || 'pareja',
    title: row.title,
    status: (row.status as RelationalCaseStatus) || 'activo',
    secretsPolicy: (row.secrets_policy as SecretsPolicy) || '',
    secretsPolicySetAt: row.secrets_policy_set_at,
    contraindicationReason: row.contraindication_reason,
    // Perfil cifrado at-rest: se descifra y parsea (tolerante a vacío/corrupto) al leer.
    profile: parseCaseProfile(row.profile_json ? decryptField(row.profile_json) : ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Casos relacionales acotados al dueño (owner_user_id) — frontera del caso (§10). */
export class SqliteRelationalCaseRepository implements RelationalCaseRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(relationalCase: RelationalCase): Promise<void> {
    const p = relationalCase.toPrimitives();
    await this.db.execute(
      `INSERT INTO relational_cases (id, owner_user_id, kind, title, status, secrets_policy, secrets_policy_set_at, contraindication_reason, profile_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           status = excluded.status,
           secrets_policy = excluded.secrets_policy,
           secrets_policy_set_at = excluded.secrets_policy_set_at,
           contraindication_reason = excluded.contraindication_reason,
           profile_json = excluded.profile_json,
           updated_at = excluded.updated_at
         WHERE relational_cases.owner_user_id = excluded.owner_user_id`,
      [
        p.id,
        p.ownerUserId,
        p.kind,
        p.title,
        p.status,
        p.secretsPolicy,
        p.secretsPolicySetAt,
        p.contraindicationReason,
        encryptField(JSON.stringify(p.profile)),
        p.createdAt,
        p.updatedAt,
      ],
    );
  }

  public async findById(id: string): Promise<RelationalCase | null> {
    const row = await this.db.queryRow<RelationalCaseRow>(
      'SELECT * FROM relational_cases WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByOwner(): Promise<RelationalCase[]> {
    const rows = await this.db.query<RelationalCaseRow>(
      'SELECT * FROM relational_cases WHERE owner_user_id = ? ORDER BY updated_at DESC',
      [this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async listByPatient(patientId: string): Promise<RelationalCase[]> {
    const rows = await this.db.query<RelationalCaseRow>(
      `SELECT rc.* FROM relational_cases rc
         JOIN case_members cm ON cm.case_id = rc.id
         WHERE cm.patient_id = ? AND rc.owner_user_id = ?
         ORDER BY rc.updated_at DESC`,
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  /**
   * Borra un caso relacional y sus hijos. Orden: case_session_notes y case_members
   * ANTES de relational_cases (ambos tienen FK enforced a relational_cases sin
   * cascada; sin esto el DELETE del caso reventaría por la FK). SECUENCIAL (await en
   * orden), pensado para correr dentro de la transacción del adaptador al cablearse a una acción.
   */
  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM case_session_notes WHERE case_id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
    await this.db.execute('DELETE FROM case_members WHERE case_id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
    await this.db.execute('DELETE FROM relational_cases WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
