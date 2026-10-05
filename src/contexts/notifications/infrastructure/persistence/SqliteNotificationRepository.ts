import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  isNotificationKind,
  type NewNotification,
  type NotificationItem,
} from '../../domain/Notification';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

interface NotificationRow {
  id: string;
  recipient_user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  patient_id: string | null;
  remind_at: string | null;
  created_by: string | null;
  read_at: string | null;
  created_at: string;
}

function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    kind: isNotificationKind(row.kind) ? row.kind : 'novedad',
    title: row.title,
    body: row.body,
    link: row.link,
    patientId: row.patient_id,
    remindAt: row.remind_at,
    createdBy: row.created_by,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Condición de visibilidad: sin programar, o ya vencido el remind_at. */
const VISIBLE = `(remind_at IS NULL OR remind_at <= ?)`;

export class SqliteNotificationRepository implements NotificationRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public insert(notification: NewNotification): Promise<void> {
    return this.insertRow(randomUUID(), notification, false);
  }

  public insertIdempotent(id: string, notification: NewNotification): Promise<void> {
    return this.insertRow(id, notification, true);
  }

  private insertRow(
    id: string,
    notification: NewNotification,
    ignoreDuplicates: boolean,
  ): Promise<void> {
    return this.db.execute(
      `INSERT INTO notifications
         (id, recipient_user_id, kind, title, body, link, patient_id, remind_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)${ignoreDuplicates ? ' ON CONFLICT DO NOTHING' : ''}`,
      [
        id,
        notification.recipientUserId,
        notification.kind,
        notification.title,
        notification.body ?? '',
        notification.link ?? '',
        notification.patientId ?? null,
        notification.remindAt ?? null,
        notification.createdBy ?? null,
        new Date().toISOString(),
      ],
    );
  }

  public async listVisibleFor(
    recipientUserId: string,
    nowIso: string,
    limit: number,
  ): Promise<NotificationItem[]> {
    const rows = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications
        WHERE recipient_user_id = ? AND ${VISIBLE}
        ORDER BY COALESCE(remind_at, created_at) DESC, created_at DESC
        LIMIT ?`,
      [recipientUserId, nowIso, limit],
    );
    return rows.map(toItem);
  }

  public async listScheduledForPatient(
    recipientUserId: string,
    patientId: string,
    nowIso: string,
    limit: number,
  ): Promise<NotificationItem[]> {
    const rows = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications
        WHERE recipient_user_id = ? AND patient_id = ? AND remind_at IS NOT NULL AND remind_at > ?
        ORDER BY remind_at ASC
        LIMIT ?`,
      [recipientUserId, patientId, nowIso, limit],
    );
    return rows.map(toItem);
  }

  public async listUpcomingReminders(
    recipientUserId: string,
    nowIso: string,
    limit: number,
  ): Promise<NotificationItem[]> {
    const rows = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications
        WHERE recipient_user_id = ? AND kind = 'recordatorio'
          AND (remind_at IS NULL OR remind_at > ?)
        ORDER BY (remind_at IS NULL) ASC, remind_at ASC, created_at DESC
        LIMIT ?`,
      [recipientUserId, nowIso, limit],
    );
    return rows.map(toItem);
  }

  public async countUnread(recipientUserId: string, nowIso: string): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM notifications
        WHERE recipient_user_id = ? AND read_at IS NULL AND ${VISIBLE}`,
      [recipientUserId, nowIso],
    );
    return row?.n ?? 0;
  }

  public markRead(recipientUserId: string, notificationId: string, nowIso: string): Promise<void> {
    return this.db.execute(
      `UPDATE notifications SET read_at = ?
        WHERE id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [nowIso, notificationId, recipientUserId],
    );
  }

  public markAllRead(recipientUserId: string, nowIso: string): Promise<void> {
    return this.db.execute(
      `UPDATE notifications SET read_at = ?
        WHERE recipient_user_id = ? AND read_at IS NULL AND ${VISIBLE}`,
      [nowIso, recipientUserId, nowIso],
    );
  }
}
