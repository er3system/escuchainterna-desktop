import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  CaseMember,
  type MemberConsentStatus,
  type ScreeningStatus,
} from '../../domain/CaseMember';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';

interface CaseMemberRow {
  id: string;
  case_id: string;
  patient_id: string;
  owner_user_id: string;
  label: string;
  role: string | null;
  is_identified_patient: number | null;
  consent_status: string;
  screening_status: string;
  screening_at: string | null;
  created_at: string;
}

function toAggregate(row: CaseMemberRow): CaseMember {
  return CaseMember.fromPrimitives({
    id: row.id,
    caseId: row.case_id,
    patientId: row.patient_id,
    ownerUserId: row.owner_user_id,
    label: row.label,
    role: row.role ?? '',
    isIdentifiedPatient: row.is_identified_patient === 1,
    consentStatus: (row.consent_status as MemberConsentStatus) || 'pendiente',
    screeningStatus: (row.screening_status as ScreeningStatus) || 'pendiente',
    screeningAt: row.screening_at,
    createdAt: row.created_at,
  });
}

/** Miembros de un caso acotados al dueño (owner_user_id). */
export class SqliteCaseMemberRepository implements CaseMemberRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(member: CaseMember): Promise<void> {
    const p = member.toPrimitives();
    await this.db.execute(
      `INSERT INTO case_members (id, case_id, patient_id, owner_user_id, label, role, is_identified_patient, consent_status, screening_status, screening_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           role = excluded.role,
           is_identified_patient = excluded.is_identified_patient,
           consent_status = excluded.consent_status,
           screening_status = excluded.screening_status,
           screening_at = excluded.screening_at
         WHERE case_members.owner_user_id = excluded.owner_user_id`,
      [
        p.id,
        p.caseId,
        p.patientId,
        p.ownerUserId,
        p.label,
        p.role,
        p.isIdentifiedPatient ? 1 : 0,
        p.consentStatus,
        p.screeningStatus,
        p.screeningAt,
        p.createdAt,
      ],
    );
  }

  public async findById(id: string): Promise<CaseMember | null> {
    const row = await this.db.queryRow<CaseMemberRow>(
      'SELECT * FROM case_members WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByCase(caseId: string): Promise<CaseMember[]> {
    const rows = await this.db.query<CaseMemberRow>(
      'SELECT * FROM case_members WHERE case_id = ? AND owner_user_id = ? ORDER BY created_at ASC',
      [caseId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async findByCaseAndPatient(caseId: string, patientId: string): Promise<CaseMember | null> {
    const row = await this.db.queryRow<CaseMemberRow>(
      'SELECT * FROM case_members WHERE case_id = ? AND patient_id = ? AND owner_user_id = ?',
      [caseId, patientId, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM case_members WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
