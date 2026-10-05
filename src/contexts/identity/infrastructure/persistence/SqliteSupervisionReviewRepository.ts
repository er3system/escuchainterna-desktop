import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import type {
  SupervisionReviewPrimitives,
  SupervisionReviewWithAuthor,
} from '../../domain/SupervisionReview';
import type { SupervisionReviewRepository } from '../../domain/repositories/SupervisionReviewRepository';

interface ReviewRow {
  id: string;
  session_note_id: string;
  supervisor_user_id: string;
  supervised_user_id: string;
  comment: string;
  reviewed: number;
  created_at: string;
  updated_at: string;
}

/** Cifrado at-rest (v3 §1.1): el comentario se cifra al escribir y se descifra al leer. */
function toPrimitives(row: ReviewRow): SupervisionReviewPrimitives {
  return {
    id: row.id,
    sessionNoteId: row.session_note_id,
    supervisorUserId: row.supervisor_user_id,
    supervisedUserId: row.supervised_user_id,
    comment: decryptField(row.comment),
    reviewed: row.reviewed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteSupervisionReviewRepository implements SupervisionReviewRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async findByNoteAndSupervisor(
    sessionNoteId: string,
    supervisorUserId: string,
  ): Promise<SupervisionReviewPrimitives | null> {
    const row = await this.db.queryRow<ReviewRow>(
      `SELECT * FROM supervision_session_reviews
          WHERE session_note_id = ? AND supervisor_user_id = ?`,
      [sessionNoteId, supervisorUserId],
    );
    return row ? toPrimitives(row) : null;
  }

  public async save(review: SupervisionReviewPrimitives): Promise<void> {
    await this.db.execute(
      `INSERT INTO supervision_session_reviews
           (id, session_note_id, supervisor_user_id, supervised_user_id, comment, reviewed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_note_id, supervisor_user_id) DO UPDATE SET
           comment = excluded.comment,
           reviewed = excluded.reviewed,
           updated_at = excluded.updated_at`,
      [
        review.id,
        review.sessionNoteId,
        review.supervisorUserId,
        review.supervisedUserId,
        encryptField(review.comment),
        review.reviewed ? 1 : 0,
        review.createdAt,
        review.updatedAt,
      ],
    );
  }

  public async listForNotes(
    sessionNoteIds: string[],
    supervisorUserId: string,
  ): Promise<SupervisionReviewPrimitives[]> {
    if (sessionNoteIds.length === 0) return [];
    const placeholders = sessionNoteIds.map(() => '?').join(', ');
    const rows = await this.db.query<ReviewRow>(
      `SELECT * FROM supervision_session_reviews
          WHERE supervisor_user_id = ? AND session_note_id IN (${placeholders})`,
      [supervisorUserId, ...sessionNoteIds],
    );
    return rows.map(toPrimitives);
  }

  public async listForSupervisedNote(
    sessionNoteId: string,
    supervisedUserId: string,
  ): Promise<SupervisionReviewWithAuthor[]> {
    const rows = await this.db.query<ReviewRow & { supervisor_name: string }>(
      `SELECT r.*, COALESCE(NULLIF(p.full_name, ''), u.email) AS supervisor_name
           FROM supervision_session_reviews r
           JOIN users u ON u.id = r.supervisor_user_id
           LEFT JOIN practitioner_profile p ON p.user_id = r.supervisor_user_id
          WHERE r.session_note_id = ? AND r.supervised_user_id = ?
          ORDER BY r.updated_at DESC`,
      [sessionNoteId, supervisedUserId],
    );
    return rows.map((row) => ({ ...toPrimitives(row), supervisorName: row.supervisor_name }));
  }

  public async listReviewedNoteIds(supervisedUserId: string, patientId: string): Promise<string[]> {
    const rows = await this.db.query<{ note_id: string }>(
      `SELECT DISTINCT r.session_note_id AS note_id
           FROM supervision_session_reviews r
           JOIN session_notes n ON n.id = r.session_note_id
          WHERE r.supervised_user_id = ? AND n.patient_id = ? AND r.reviewed = 1`,
      [supervisedUserId, patientId],
    );
    return rows.map((row) => row.note_id);
  }
}
