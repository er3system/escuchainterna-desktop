import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { sameConsultorioSql } from '@/shared/infrastructure/persistence/consultorioSql';
import { decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import type { SupervisionCaseData } from '@/contexts/clinical-records/domain/SessionInsights';
import type { SupervisionScope } from '../../domain/SupervisionLink';
import type {
  ReviewableNote,
  SupervisionAccessReader,
} from '../../domain/repositories/SupervisionAccessReader';

function parseScope(json: string): SupervisionScope {
  try {
    const raw = JSON.parse(json || '{}') as Partial<SupervisionScope>;
    return { notas: raw.notas ?? true, historias: raw.historias ?? true, pagos: raw.pagos ?? false };
  } catch {
    return { notas: true, historias: true, pagos: false };
  }
}

/**
 * Lecturas de supervisión activa. El vínculo de supervisión va en el JOIN de
 * cada query (estructural): sin vínculo vigente no sale ni una fila, y el
 * alcance (scope_json) decide qué secciones se exponen.
 */
export class SqliteSupervisionAccessReader implements SupervisionAccessReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async findReviewableNote(
    sessionNoteId: string,
    supervisorUserId: string,
  ): Promise<ReviewableNote | null> {
    const row = await this.db.queryRow<{
      id: string;
      title: string;
      patient_id: string;
      owner_user_id: string;
      scope_json: string;
    }>(
      `SELECT n.id, n.title, n.patient_id, n.owner_user_id, l.scope_json
           FROM session_notes n
           JOIN supervision_links l
             ON l.supervised_user_id = n.owner_user_id AND l.supervisor_user_id = ?
            AND l.revoked_at IS NULL
           JOIN users u ON u.id = l.supervised_user_id AND u.status = 'activo'
          WHERE n.id = ?
            AND ${sameConsultorioSql('l.organization_id', 'l.supervisor_user_id', 'l.supervised_user_id')}`,
      [supervisorUserId, sessionNoteId],
    );
    if (!row) return null;
    if (!parseScope(row.scope_json).notas) return null;
    return {
      sessionNoteId: row.id,
      noteTitle: row.title,
      patientId: row.patient_id,
      supervisedUserId: row.owner_user_id,
    };
  }

  public async loadCase(
    supervisorUserId: string,
    supervisedUserId: string,
    patientId: string,
  ): Promise<SupervisionCaseData | null> {
    // Vínculo vigente + paciente del supervisado, en una sola query estructural.
    const head = await this.db.queryRow<{
      full_name: string;
      gender: string;
      birth_date: string | null;
      consultation_reason: string;
      therapy_start_date: string | null;
      scope_json: string;
      supervised_name: string;
    }>(
      `SELECT pa.full_name, pa.gender, pa.birth_date, pa.consultation_reason, pa.therapy_start_date,
                l.scope_json,
                COALESCE(NULLIF(pr.full_name, ''), u.email) AS supervised_name
           FROM supervision_links l
           JOIN users u ON u.id = l.supervised_user_id
           LEFT JOIN practitioner_profile pr ON pr.user_id = l.supervised_user_id
           JOIN patients pa ON pa.owner_user_id = l.supervised_user_id AND pa.id = ?
          WHERE l.supervisor_user_id = ? AND l.supervised_user_id = ?
            AND l.revoked_at IS NULL AND u.status = 'activo'
            AND ${sameConsultorioSql('l.organization_id', 'l.supervisor_user_id', 'l.supervised_user_id')}`,
      [patientId, supervisorUserId, supervisedUserId],
    );
    if (!head) return null;
    const scope = parseScope(head.scope_json);

    const notes = scope.notas
      ? (
          await this.db.query<{ title: string; content: string; created_at: string }>(
            `SELECT title, content, created_at FROM session_notes
                WHERE owner_user_id = ? AND patient_id = ?
                ORDER BY created_at ASC`,
            [supervisedUserId, patientId],
          )
        ).map((row) => ({
          title: row.title,
          // Cifrado at-rest: el contenido clínico se descifra al leer.
          content: decryptField(row.content),
          createdAt: row.created_at,
        }))
      : [];

    const records = scope.historias
      ? (
          await this.db.query<{
            title: string;
            updated_at: string;
            template_name: string | null;
          }>(
            `SELECT r.title, r.updated_at, t.name AS template_name
                 FROM clinical_records r
                 LEFT JOIN clinical_record_templates t ON t.id = r.template_id
                WHERE r.owner_user_id = ? AND r.patient_id = ?
                ORDER BY r.updated_at DESC`,
            [supervisedUserId, patientId],
          )
        ).map((row) => ({
          title: row.title,
          templateName: row.template_name ?? 'Formato libre',
          updatedAt: row.updated_at,
        }))
      : [];

    const diagnoses = (
      await this.db.query<{ cie11_code: string; cie11_title: string; status: string }>(
        `SELECT cie11_code, cie11_title, status FROM diagnoses
            WHERE owner_user_id = ? AND patient_id = ?
            ORDER BY diagnosed_at DESC`,
        [supervisedUserId, patientId],
      )
    ).map((row) => ({ code: row.cie11_code, title: row.cie11_title, status: row.status }));

    return {
      patientName: head.full_name,
      gender: head.gender,
      birthDate: head.birth_date,
      consultationReason: decryptField(head.consultation_reason),
      therapyStartDate: head.therapy_start_date,
      supervisedName: head.supervised_name,
      diagnoses,
      notes,
      records,
    };
  }
}
