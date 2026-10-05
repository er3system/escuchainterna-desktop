import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { SessionNote } from '../../domain/SessionNote';
import type { ClinicalAnswers } from '../../domain/ClinicalRecord';
import type { SessionKind } from '../../domain/sessionTemplates';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';

interface SessionNoteRow {
  id: string;
  patient_id: string;
  booking_id: string | null;
  title: string;
  content: string;
  template_id: string | null;
  answers_json: string;
  sections_json: string;
  session_kind: string;
  archived: number;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Parsea sections_json (EN CLARO); '' o malformado = sin bloques (null). */
function parseSections(raw: string): ClinicalSection[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ClinicalSection[]) : null;
  } catch {
    return null;
  }
}

function toAggregate(row: SessionNoteRow): SessionNote {
  return SessionNote.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    bookingId: row.booking_id,
    title: row.title,
    // Cifrado at-rest (v3 §1.1): el contenido clínico se descifra al leer.
    content: decryptField(row.content),
    templateId: row.template_id,
    // answers_json también es contenido clínico (cifrado); estructura via plantilla.
    answers: JSON.parse(decryptField(row.answers_json || '{}')) as ClinicalAnswers,
    // sections_json es ESTRUCTURA (snapshot de bloques): va EN CLARO, no se cifra.
    sections: parseSections(row.sections_json),
    sessionKind: (row.session_kind as SessionKind) || 'seguimiento',
    archived: row.archived === 1,
    position: row.position ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Notas de sesión acotadas al dueño (owner_user_id) de la sesión. */
export class SqliteSessionNoteRepository implements SessionNoteRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(note: SessionNote): Promise<void> {
    const primitives = note.toPrimitives();
    await this.db.execute(
      // La columna integrated_at sigue existiendo en la tabla (migración v13,
      // inmutable) pero quedó INERTE tras el pivote del Expediente: ya no se lee
      // ni se escribe. Se omite del INSERT (queda NULL) y del UPDATE.
      `INSERT INTO session_notes (id, patient_id, booking_id, title, content, template_id, answers_json, sections_json, session_kind, archived, position, created_at, updated_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           answers_json = excluded.answers_json,
           sections_json = excluded.sections_json,
           archived = excluded.archived,
           position = excluded.position,
           updated_at = excluded.updated_at
         WHERE session_notes.owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.patientId,
        primitives.bookingId,
        primitives.title,
        encryptField(primitives.content),
        primitives.templateId,
        encryptField(JSON.stringify(primitives.answers)),
        // sections_json EN CLARO (estructura, no PII): '' cuando no hay bloques.
        primitives.sections && primitives.sections.length > 0
          ? JSON.stringify(primitives.sections)
          : '',
        primitives.sessionKind,
        primitives.archived ? 1 : 0,
        primitives.position ?? 0,
        primitives.createdAt,
        primitives.updatedAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<SessionNote | null> {
    const row = await this.db.queryRow<SessionNoteRow>(
      'SELECT * FROM session_notes WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<SessionNote[]> {
    // Orden manual de la Evolución (P8): position ASC = orden de lectura/cronológico.
    const rows = await this.db.query<SessionNoteRow>(
      'SELECT * FROM session_notes WHERE patient_id = ? AND owner_user_id = ? ORDER BY position ASC, created_at ASC',
      [patientId, this.ownerUserId],
    );
    return rows.map(toAggregate);
  }

  public async delete(id: string): Promise<void> {
    const owned = await this.db.queryRow<{ id: string }>(
      'SELECT id FROM session_notes WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    if (!owned) return;
    // Borrado multi-tabla SECUENCIAL (await en orden): pensado para correr dentro de
    // transacción del adaptador abierta por el caller (atómico o nada).
    await this.db.execute('DELETE FROM ai_interactions WHERE session_note_id = ?', [id]);
    // Reviews de supervisión que apuntan a esta nota (sin FK): se limpian para no
    // dejar referencias colgantes a una nota borrada. Pensado para correr en transacción.
    await this.db.execute('DELETE FROM supervision_session_reviews WHERE session_note_id = ?', [id]);
    await this.db.execute('DELETE FROM session_notes WHERE id = ?', [id]);
  }
}
