import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Endurecimiento de login (v3 §1.3): 5 intentos fallidos → bloqueo 15 min;
 * el éxito limpia el contador; un bloqueo vencido reinicia el ciclo.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-lockout-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let attempts: typeof import('@/shared/infrastructure/auth/loginAttempts');

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  attempts = await import('@/shared/infrastructure/auth/loginAttempts');
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

describe('Bloqueo por intentos fallidos', () => {
  it('bloquea 15 minutos tras 5 intentos fallidos', async () => {
    const email = 'bloqueada@correo.test';
    for (let i = 1; i <= 4; i += 1) {
      expect((await attempts.registerFailedAttempt(email)).locked).toBe(false);
      expect((await attempts.lockStatus(email)).locked).toBe(false);
    }
    const fifth = await attempts.registerFailedAttempt(email);
    expect(fifth.locked).toBe(true);
    expect(fifth.minutesLeft).toBe(attempts.LOCK_MINUTES);

    const status = await attempts.lockStatus(email);
    expect(status.locked).toBe(true);
    expect(status.minutesLeft).toBeGreaterThan(0);
    expect(status.minutesLeft).toBeLessThanOrEqual(attempts.LOCK_MINUTES);
  });

  it('normaliza el correo (mayúsculas y espacios cuentan igual)', async () => {
    const email = 'Mixto@Correo.Test';
    for (let i = 0; i < attempts.MAX_FAILED_ATTEMPTS; i += 1) {
      await attempts.registerFailedAttempt(i % 2 === 0 ? email : `  ${email.toLowerCase()} `);
    }
    expect((await attempts.lockStatus('mixto@correo.test')).locked).toBe(true);
  });

  it('el intento exitoso limpia el contador', async () => {
    const email = 'limpia@correo.test';
    for (let i = 0; i < attempts.MAX_FAILED_ATTEMPTS; i += 1) await attempts.registerFailedAttempt(email);
    expect((await attempts.lockStatus(email)).locked).toBe(true);

    await attempts.clearLoginAttempts(email);
    expect((await attempts.lockStatus(email)).locked).toBe(false);
    expect((await attempts.registerFailedAttempt(email)).locked).toBe(false); // ciclo nuevo
  });

  it('un bloqueo vencido reinicia el ciclo en lugar de bloquear de inmediato', async () => {
    const email = 'vencida@correo.test';
    for (let i = 0; i < attempts.MAX_FAILED_ATTEMPTS; i += 1) await attempts.registerFailedAttempt(email);
    expect((await attempts.lockStatus(email)).locked).toBe(true);

    // Simula que pasaron los 15 minutos.
    getDb()
      .prepare('UPDATE login_attempts SET locked_until = ? WHERE email = ?')
      .run(new Date(Date.now() - 1000).toISOString(), email);

    expect((await attempts.lockStatus(email)).locked).toBe(false);
    const next = await attempts.registerFailedAttempt(email);
    expect(next.locked).toBe(false); // cuenta como intento 1 del ciclo nuevo
  });

  it('correos no registrados también cuentan (no se revela existencia)', async () => {
    const email = 'no-existe@correo.test';
    for (let i = 0; i < attempts.MAX_FAILED_ATTEMPTS; i += 1) await attempts.registerFailedAttempt(email);
    expect((await attempts.lockStatus(email)).locked).toBe(true);
  });
});
