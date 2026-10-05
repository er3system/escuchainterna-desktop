import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Boletín de pre-lanzamiento (banner "sitio en desarrollo" de la landing):
 * suscripción válida guarda normalizado; duplicado idempotente sin revelar
 * existencia; formato inválido rechazado sin tocar la tabla.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-newsletter-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let newsletter: typeof import('@/shared/infrastructure/newsletter/NewsletterSubscribers');

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  newsletter = await import('@/shared/infrastructure/newsletter/NewsletterSubscribers');
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

describe('Boletín de pre-lanzamiento', () => {
  it('suscribe un correo válido y lo normaliza (trim + minúsculas)', async () => {
    const result = await newsletter.subscribeToNewsletter('  Ana.Prueba@Correo.Test  ');
    expect(result.ok).toBe(true);

    const list = await newsletter.listNewsletterSubscribers();
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('ana.prueba@correo.test');
    expect(list[0].source).toBe('banner_prelanzamiento');
    expect(await newsletter.countNewsletterSubscribers()).toBe(1);
  });

  it('el duplicado es idempotente y responde ok (no revela existencia)', async () => {
    const again = await newsletter.subscribeToNewsletter('ANA.PRUEBA@correo.test');
    expect(again.ok).toBe(true);
    expect(await newsletter.countNewsletterSubscribers()).toBe(1);
  });

  it('rechaza formatos inválidos sin tocar la tabla', async () => {
    for (const invalid of ['', '   ', 'sin-arroba', 'a@b', 'a@b.c', `x@y.${'z'.repeat(260)}`]) {
      expect((await newsletter.subscribeToNewsletter(invalid)).ok).toBe(false);
    }
    expect(await newsletter.countNewsletterSubscribers()).toBe(1);
  });

  it('acepta otra fuente de captura y la registra', async () => {
    const result = await newsletter.subscribeToNewsletter('otra@correo.test', 'footer');
    expect(result.ok).toBe(true);
    const list = await newsletter.listNewsletterSubscribers();
    expect(list.map((s) => s.email)).toContain('otra@correo.test');
    expect(list.find((s) => s.email === 'otra@correo.test')?.source).toBe('footer');
    expect(await newsletter.countNewsletterSubscribers()).toBe(2);
  });
});
