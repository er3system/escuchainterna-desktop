import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreateReminderMessage } from '@/contexts/notifications/application/create-reminder/CreateReminderMessage';
import { PublishAnnouncementMessage } from '@/contexts/notifications/application/publish-announcement/PublishAnnouncementMessage';
import { SendOrgNoticeMessage } from '@/contexts/notifications/application/send-org-notice/SendOrgNoticeMessage';
import { InvalidNotificationContentError } from '@/contexts/notifications/domain/errors/InvalidNotificationContentError';

/**
 * Notificaciones in-app (v3 §12): recordatorios (con duplicado al titular y
 * visibilidad desde remind_at), fan-out perezoso e idempotente de novedades
 * por audiencia y avisos de organización.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-notificaciones-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let useCases: ReturnType<
  typeof import('@/contexts/notifications/infrastructure/createNotificationUseCases')['createNotificationUseCases']
>;

const adminId = `admin-${randomUUID()}`;
const psychologistId = `psico-${randomUUID()}`;
const orgMasterId = `master-${randomUUID()}`;
const assistantId = `asistente-${randomUUID()}`;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { createNotificationUseCases } = await import(
    '@/contexts/notifications/infrastructure/createNotificationUseCases'
  );
  useCases = createNotificationUseCases();

  const db = getDb();
  const past = new Date(Date.now() - 60_000).toISOString();
  for (const [id, email, role] of [
    [adminId, 'admin@correo.test', 'admin'],
    [psychologistId, 'psico@correo.test', 'psychologist'],
    [orgMasterId, 'master@correo.test', 'org_master'],
    [assistantId, 'asistente@correo.test', 'assistant'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, 'hash', ?, 'activo', ?)`,
    ).run(id, email, role, past);
  }
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('CreateReminder', () => {
  it('duplica el recordatorio del asistente al titular', async () => {
    await useCases.createReminder.create(
      new CreateReminderMessage({
        createdByUserId: assistantId,
        recipientUserIds: [assistantId, psychologistId],
        title: 'Confirmar sesión del jueves',
        body: 'Llamar antes de las 12',
      }),
    );
    const rows = getDb()
      .prepare(
        `SELECT recipient_user_id FROM notifications WHERE kind = 'recordatorio' AND title = ?`,
      )
      .all('Confirmar sesión del jueves') as unknown as Array<{ recipient_user_id: string }>;
    expect(rows.map((row) => row.recipient_user_id).sort()).toEqual(
      [assistantId, psychologistId].sort(),
    );
  });

  it('exige título y al menos un destinatario', () => {
    expect(
      () =>
        new CreateReminderMessage({
          createdByUserId: psychologistId,
          recipientUserIds: [psychologistId],
          title: '   ',
        }),
    ).toThrow(InvalidNotificationContentError);
    expect(
      () =>
        new CreateReminderMessage({
          createdByUserId: psychologistId,
          recipientUserIds: [],
          title: 'Hola',
        }),
    ).toThrow(InvalidNotificationContentError);
  });

  it('un recordatorio programado a futuro no es visible ni cuenta como no leído', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await useCases.createReminder.create(
      new CreateReminderMessage({
        createdByUserId: psychologistId,
        recipientUserIds: [psychologistId],
        title: 'Recordatorio futuro',
        remindAt: future,
      }),
    );
    const feed = await useCases.listNotifications.list(psychologistId);
    expect(feed.items.some((item) => item.title === 'Recordatorio futuro')).toBe(false);

    // "Marcar todas" tampoco lo toca: seguirá sin leer cuando venza.
    await useCases.markAllNotificationsRead.markAll(psychologistId);
    const stillUnread = getDb()
      .prepare(`SELECT read_at FROM notifications WHERE title = 'Recordatorio futuro'`)
      .get() as { read_at: string | null };
    expect(stillUnread.read_at).toBeNull();
  });

  it('un recordatorio con remind_at vencido sí aparece y cuenta', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    await useCases.createReminder.create(
      new CreateReminderMessage({
        createdByUserId: psychologistId,
        recipientUserIds: [psychologistId],
        title: 'Recordatorio vencido',
        remindAt: past,
      }),
    );
    const feed = await useCases.listNotifications.list(psychologistId);
    expect(feed.items.some((item) => item.title === 'Recordatorio vencido')).toBe(true);
    expect(feed.unread).toBeGreaterThan(0);
  });
});

describe('novedades del admin (fan-out perezoso)', () => {
  it('materializa la novedad por audiencia al abrir la campana, sin duplicar', async () => {
    await useCases.publishAnnouncement.publish(
      new PublishAnnouncementMessage({
        title: 'Solo psicólogos',
        body: 'Nueva función clínica',
        audience: 'psicologos',
        createdBy: adminId,
      }),
    );

    const first = await useCases.listNotifications.list(psychologistId);
    expect(first.items.filter((item) => item.title === 'Solo psicólogos')).toHaveLength(1);

    // Idempotente: abrir de nuevo no duplica.
    const second = await useCases.listNotifications.list(psychologistId);
    expect(second.items.filter((item) => item.title === 'Solo psicólogos')).toHaveLength(1);

    // El org_master no es audiencia de 'psicologos'.
    const masterFeed = await useCases.listNotifications.list(orgMasterId);
    expect(masterFeed.items.some((item) => item.title === 'Solo psicólogos')).toBe(false);
  });

  it("audiencia 'organizaciones' llega al org_master y no al psicólogo independiente", async () => {
    await useCases.publishAnnouncement.publish(
      new PublishAnnouncementMessage({
        title: 'Solo organizaciones',
        audience: 'organizaciones',
        createdBy: adminId,
      }),
    );
    expect(
      (await useCases.listNotifications.list(orgMasterId)).items.some(
        (i) => i.title === 'Solo organizaciones',
      ),
    ).toBe(true);
    expect(
      (await useCases.listNotifications.list(psychologistId)).items.some(
        (i) => i.title === 'Solo organizaciones',
      ),
    ).toBe(false);
  });

  it('las novedades anteriores al registro del usuario no se materializan', async () => {
    await useCases.publishAnnouncement.publish(
      new PublishAnnouncementMessage({ title: 'Antigua', audience: 'todos', createdBy: adminId }),
    );
    const lateUserId = `tardio-${randomUUID()}`;
    getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, status, created_at)
         VALUES (?, 'tardio@correo.test', 'hash', 'psychologist', 'activo', ?)`,
      )
      .run(lateUserId, new Date(Date.now() + 1000).toISOString());

    const feed = await useCases.listNotifications.list(lateUserId);
    expect(feed.items.some((item) => item.title === 'Antigua')).toBe(false);
  });

  it('rechaza audiencias desconocidas', () => {
    expect(
      () =>
        new PublishAnnouncementMessage({
          title: 'X',
          audience: 'marcianos',
          createdBy: adminId,
        }),
    ).toThrow(InvalidNotificationContentError);
  });
});

describe('avisos de organización', () => {
  it('crea una notificación aviso_org por destinatario, excluyendo al remitente', async () => {
    const sent = await useCases.sendOrgNotice.send(
      new SendOrgNoticeMessage({
        senderUserId: orgMasterId,
        recipientUserIds: [psychologistId, orgMasterId, psychologistId],
        title: 'Fecha de corte',
        body: 'Entregar expedientes antes del 30',
      }),
    );
    expect(sent).toBe(1);

    const feed = await useCases.listNotifications.list(psychologistId);
    const notice = feed.items.find((item) => item.title === 'Fecha de corte');
    expect(notice?.kind).toBe('aviso_org');
    expect(notice?.createdBy).toBe(orgMasterId);
  });

  it('marcar todas como leídas deja el contador en cero', async () => {
    expect(await useCases.countUnread.count(psychologistId)).toBeGreaterThan(0);
    await useCases.markAllNotificationsRead.markAll(psychologistId);
    expect(await useCases.countUnread.count(psychologistId)).toBe(0);
  });
});
