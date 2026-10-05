import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { CaseSessionNote, type CaseSessionVisibility } from '../../domain/CaseSessionNote';
import type { CaseSessionNoteRepository } from '../../domain/repositories/CaseSessionNoteRepository';

interface CaseSessionNoteRow {
  id: string;
  case_id: string;
  owner_user_id: string;
  member_id: string | null;
  patient_id: string | null;
  title: string;
  content: string;
  visibility: string;
  attendees_json: string | null;
  created_at: string;
  updated_at: string;
}

function parseAttendees(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function toAggregate(row: CaseSessionNoteRow): CaseSessionNote {
  return CaseSessionNote.fromPrimitives({
    id: row.id,
    caseId: row.case_id,
    ownerUserId: row.owner_user_id,
    memberId: row.member_id,
    patientId: row.patient_id,
    title: row.title,
    // Cifrado at-rest: el contenido clínico se descifra al leer.
    content: decryptField(row.content),
    visibility: (row.visibility as CaseSessionVisibility) || 'compartido',
    attendees: parseAttendees(row.attendees_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Sesiones de caso acotadas al dueño; el contenido va cifrado at-rest. */
export class SqliteCaseSessionNoteRepository implements CaseSessionNoteRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(note: CaseSessionNote): Promise<void> {
    const p = note.toPrimitives();
    await this.db.execute(
      `INSERT INTO case_session_notes (id, case_id, owner_user_id, member_id, patient_id, title, content, visibility, attendees_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           attendees_json = excluded.attendees_json,
           updated_at = excluded.updated_at
         WHERE case_session_notes.owner_user_id = excluded.owner_user_id`,
      [
        p.id,
        p.caseId,
        p.ownerUserId,
        p.memberId,
        p.patientId,
        p.title,
        encryptField(p.content),
        p.visibility,
        JSON.stringify(p.attendees),
        p.createdAt,
        p.updatedAt,
      ],
    );
  }

  public async findById(id: string): Promise<CaseSessionNote | null> {
    const row = await this.db.queryRow<CaseSessionNoteRow>(
      'SELECT * FROM case_session_notes WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByCase(caseId: string): Promise<CaseSessionNote[]> {
    const rows = await this.db.query<CaseSessionNoteRow>(
      'SELECT * FROM case_session_notes WHERE case_id = ? AND owner_user_id = ? ORDER BY created_at DESC',
      [caseId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM case_session_notes WHERE id = ? AND owner_user_id = ?', [
      id,
      this.ownerUserId,
    ]);
  }
}
