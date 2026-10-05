import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { isAnnouncementAudience, type Announcement } from '../../domain/Announcement';
import type {
  AnnouncementRepository,
  NewAnnouncement,
} from '../../domain/repositories/AnnouncementRepository';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  created_by: string;
  created_at: string;
}

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: isAnnouncementAudience(row.audience) ? row.audience : 'todos',
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class SqliteAnnouncementRepository implements AnnouncementRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async publish(announcement: NewAnnouncement): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO announcements (id, title, body, audience, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        announcement.title,
        announcement.body,
        announcement.audience,
        announcement.createdBy,
        new Date().toISOString(),
      ],
    );
    return id;
  }

  public async listAll(): Promise<Announcement[]> {
    const rows = await this.db.query<AnnouncementRow>(
      'SELECT * FROM announcements ORDER BY created_at DESC',
    );
    return rows.map(toAnnouncement);
  }

  public async delete(announcementId: string): Promise<void> {
    // Quita también las notificaciones materializadas (id determinista nov:<id>:<usuario>).
    await this.db.execute(`DELETE FROM notifications WHERE id LIKE ?`, [`nov:${announcementId}:%`]);
    await this.db.execute('DELETE FROM announcements WHERE id = ?', [announcementId]);
  }

  /**
   * Fan-out PEREZOSO (v3 §12): materializa como notificaciones las novedades
   * que apliquen al usuario por audiencia y posteriores a su registro. Es
   * idempotente: el id determinista `nov:<announcement>:<usuario>` + INSERT OR
   * IGNORE garantizan una sola notificación por novedad y usuario.
   */
  public async fanOutPendingFor(userId: string): Promise<void> {
    const user = await this.db.queryRow<{ id: string; role: string; created_at: string }>(
      'SELECT id, role, created_at FROM users WHERE id = ?',
      [userId],
    );
    if (!user) return;

    const belongsToOrganization =
      user.role === 'org_master' ||
      user.role === 'professor' ||
      Boolean(
        await this.db.queryRow(
          'SELECT 1 AS x FROM organization_memberships WHERE user_id = ? LIMIT 1',
          [userId],
        ),
      );

    const audiences = ['todos'];
    if (user.role === 'psychologist') audiences.push('psicologos');
    if (belongsToOrganization) audiences.push('organizaciones');

    const placeholders = audiences.map(() => '?').join(', ');
    const pending = await this.db.query<AnnouncementRow>(
      `SELECT a.id, a.title, a.body, a.created_by, a.created_at
         FROM announcements a
        WHERE a.audience IN (${placeholders})
          AND a.created_at >= ?
          AND NOT EXISTS (
            SELECT 1 FROM notifications n WHERE n.id = 'nov:' || a.id || ':' || ?
          )`,
      [...audiences, user.created_at, userId],
    );

    const nowIso = new Date().toISOString();
    for (const row of pending) {
      await this.db.execute(
        `INSERT INTO notifications
           (id, recipient_user_id, kind, title, body, link, created_by, created_at)
         VALUES (?, ?, 'novedad', ?, ?, '/notificaciones', ?, ?)
         ON CONFLICT DO NOTHING`,
        [`nov:${row.id}:${userId}`, userId, row.title, row.body, row.created_by, nowIso],
      );
    }
  }
}
