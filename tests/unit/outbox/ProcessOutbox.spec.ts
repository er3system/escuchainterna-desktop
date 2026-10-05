import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { UUID } from '@haskou/value-objects';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';
import { PersonalProviderCredentials } from '@/contexts/practitioner/domain/value-objects/PersonalProviderCredentials';
import { sendTransactionalEmail } from '@/shared/infrastructure/notifications/ResendEmailSender';
import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Worker durable del outbox (re-plataforma 0f): drena los correos pendientes y
 * vencidos. Sin proveedor real (tests), el envío es no-op "sin_proveedor" → el
 * worker marca 'enviado'. Verifica también los filtros de canal y de vencimiento.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-outbox-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let processOutbox: typeof import('@/shared/infrastructure/outbox/processOutbox')['processOutbox'];
let outboxBackoffMs: typeof import('@/shared/infrastructure/outbox/processOutbox')['outboxBackoffMs'];

function insertMessage(opts: {
  channel: 'email' | 'whatsapp';
  status: string;
  nextAttemptAt?: string | null;
  recipient?: string;
}): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO outbox_messages
        (id, channel, recipient, recipient_name, template, subject, body, status, attempts, next_attempt_at, created_at)
       VALUES (?, ?, ?, '', 'recordatorio_sesion', 'Asunto', 'Cuerpo', ?, 0, ?, ?)`,
    )
    .run(
      id,
      opts.channel,
      opts.recipient ?? 'dest@correo.test',
      opts.status,
      opts.nextAttemptAt ?? null,
      new Date().toISOString(),
    );
  return id;
}

function statusOf(id: string): string {
  const row = getDb()
    .prepare('SELECT status FROM outbox_messages WHERE id = ?')
    .get(id) as { status: string };
  return row.status;
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  delete (globalThis as { __escuchainternaDbAdapter?: unknown }).__escuchainternaDbAdapter;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ processOutbox, outboxBackoffMs } = await import(
    '@/shared/infrastructure/outbox/processOutbox'
  ));
  getDb(); // fuerza migraciones (incl. v56: attempts/next_attempt_at)
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    /* ya cerrada */
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  delete (globalThis as { __escuchainternaDbAdapter?: unknown }).__escuchainternaDbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('processOutbox', () => {
  it('drena un correo pendiente y vencido → enviado (modo simulado sin proveedor)', async () => {
    const id = insertMessage({ channel: 'email', status: 'pendiente' });
    const result = await processOutbox();
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(statusOf(id)).toBe('enviado');
  });

  it('NO toca un correo con next_attempt_at a futuro (aún no vencido)', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const id = insertMessage({ channel: 'email', status: 'pendiente', nextAttemptAt: future });
    await processOutbox();
    expect(statusOf(id)).toBe('pendiente');
  });

  it('NO procesa WhatsApp (solo correo tiene envío real)', async () => {
    const id = insertMessage({ channel: 'whatsapp', status: 'pendiente' });
    await processOutbox();
    expect(statusOf(id)).toBe('pendiente');
  });

  it('NO re-procesa lo ya enviado', async () => {
    const id = insertMessage({ channel: 'email', status: 'enviado' });
    const result = await processOutbox();
    expect(statusOf(id)).toBe('enviado');
    // 'enviado' no entra en el drenado (solo 'pendiente').
    expect(result.processed).toBe(0);
  });

  it('backoff exponencial creciente con tope', () => {
    expect(outboxBackoffMs(1)).toBe(60_000);
    expect(outboxBackoffMs(2)).toBe(300_000);
    expect(outboxBackoffMs(3)).toBe(1_500_000);
    expect(outboxBackoffMs(10)).toBe(6 * 60 * 60_000); // tope de 6h
  });
});

describe('correo de escritorio con claves propias', () => {
  const owner = new UUID('33333333-3333-4333-8333-333333333333');
  const other = '44444444-4444-4444-8444-444444444444';
  const email = { to: 'dest@example.test', subject: 'Prueba', body: 'Texto ficticio' };
  function desktop(): void {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    vi.stubEnv('DATA_ENCRYPTION_KEY', 'desktop-mail-test-key-0123456789');
  }
  it('sin clave personal no usa credenciales de plataforma ni afirma que envió el correo', async () => {
    desktop();
    vi.stubEnv('RESEND_API_KEY', 're_platform_key_123456');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await sendTransactionalEmail(email, other)).toEqual({ sent: false, reason: 'sin_proveedor' });
    const id = await writeOutboxMessage({ channel: 'email', recipient: email.to, template: 'correo_masivo', body: email.body, ownerUserId: other });
    const row = getDb().prepare('SELECT status, created_at, sent_at FROM outbox_messages WHERE id = ?').get(id);
    expect(row).toMatchObject({ status: 'omitido', sent_at: null });
    expect(row?.created_at).toEqual(expect.any(String));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('usa el remitente y clave del dueño y cambia a enviado solo tras éxito real', async () => {
    desktop();
    await new SqlitePersonalProviderRepository().save(owner, PersonalProviderCredentials.create('resend', 're_owner_test_key_123456', '', 'consulta@example.test', true));
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
    const id = await writeOutboxMessage({ channel: 'email', recipient: email.to, subject: email.subject, template: 'correo_masivo', body: email.body, ownerUserId: owner.toString() });
    await vi.waitFor(() => expect(statusOf(id)).toBe('enviado'));
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer re_owner_test_key_123456');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).from).toBe('consulta@example.test');
    expect(await sendTransactionalEmail(email, other)).toEqual({ sent: false, reason: 'sin_proveedor' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('los reintentos exigen dueño y dos solicitudes simultáneas no duplican el envío', async () => {
    desktop();
    const id = insertMessage({ channel: 'email', status: 'pendiente' });
    const foreign = insertMessage({ channel: 'email', status: 'pendiente' });
    getDb().prepare('UPDATE outbox_messages SET owner_user_id = ? WHERE id = ?').run(owner.toString(), id);
    getDb().prepare('UPDATE outbox_messages SET owner_user_id = ? WHERE id = ?').run(other, foreign);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 }))); vi.stubGlobal('fetch', fetcher);
    await expect(processOutbox()).rejects.toThrow('cuenta en sesión');
    await Promise.all([processOutbox(50, owner.toString()), processOutbox(50, owner.toString())]);
    expect(statusOf(id)).toBe('enviado');
    expect(statusOf(foreign)).toBe('pendiente');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
