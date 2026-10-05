import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
