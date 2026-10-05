import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  SupervisionReviewNotice,
  SupervisionReviewNotifier,
} from '../../domain/SupervisionReviewNotifier';

/**
 * Adaptador local del aviso al supervisado (v3.2): escribe una notificación
 * in-app (campana, kind 'supervision') directamente en la tabla
 * `notifications` del contexto de notificaciones — sin red, visible de
 * inmediato. El link lleva a la nota del estudiante, donde verá la
 * retroalimentación de su supervisor.
 */
export class InAppSupervisionReviewNotifier implements SupervisionReviewNotifier {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async notifyReviewSaved(notice: SupervisionReviewNotice): Promise<void> {
    const supervisor = await this.db.queryRow<{ display_name: string }>(
      `SELECT COALESCE(NULLIF(p.full_name, ''), u.email) AS display_name
           FROM users u
           LEFT JOIN practitioner_profile p ON p.user_id = u.id
          WHERE u.id = ?`,
      [notice.supervisorUserId],
    );
    const supervisorName = supervisor?.display_name ?? 'Tu supervisor';

    const title =
      notice.change === 'comentario'
        ? 'Retroalimentación de tu supervisor'
        : 'Nota revisada por tu supervisor';
    const body =
      notice.change === 'comentario'
        ? `${supervisorName} dejó retroalimentación en tu nota "${notice.noteTitle}".`
        : `${supervisorName} marcó tu nota "${notice.noteTitle}" como revisada.`;

    await this.db.execute(
      `INSERT INTO notifications (id, recipient_user_id, kind, title, body, link, patient_id, created_by, created_at)
       VALUES (?, ?, 'supervision', ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        notice.supervisedUserId,
        title,
        body,
        `/pacientes/${notice.patientId}/sesiones/${notice.sessionNoteId}`,
        notice.patientId,
        notice.supervisorUserId,
        new Date().toISOString(),
      ],
    );
  }
}
