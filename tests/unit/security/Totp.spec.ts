import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { generate } from 'otplib';

/**
 * TOTP opt-in (v3 §1.3): activación con confirmación, secreto cifrado at-rest
 * y desactivación protegida por código.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-totp-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let totp: typeof import('@/shared/infrastructure/auth/totp');
let isEncrypted: typeof import('@/shared/infrastructure/crypto/FieldEncryption')['isEncrypted'];

const userId = `user-${randomUUID()}`;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  totp = await import('@/shared/infrastructure/auth/totp');
  ({ isEncrypted } = await import('@/shared/infrastructure/crypto/FieldEncryption'));

  getDb()
    .prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, 'totp@correo.test', 'hash', 'psychologist', 'activo', new Date().toISOString());
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

describe('TOTP opt-in', () => {
  it('flujo completo: configurar → confirmar → verificar → desactivar', async () => {
    expect(await totp.totpEnabled(userId)).toBe(false);

    const setup = await totp.beginTotpSetup(userId);
    expect(setup).not.toBeNull();
    expect(setup!.otpauthUrl).toContain('otpauth://totp/');
    expect(setup!.otpauthUrl).toContain('EscuchaInterna');
    expect(setup!.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // El secreto se guarda CIFRADO en la BD.
    const stored = getDb()
      .prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
      .get(userId) as { totp_secret: string; totp_enabled: number };
    expect(isEncrypted(stored.totp_secret)).toBe(true);
    expect(stored.totp_enabled).toBe(0); // pendiente hasta confirmar

    // Código inválido NO activa.
    expect(await totp.confirmTotpSetup(userId, '000000')).toBe(false);
    expect(await totp.totpEnabled(userId)).toBe(false);

    // Código válido activa.
    const code = await generate({ secret: setup!.secret });
    expect(await totp.confirmTotpSetup(userId, code)).toBe(true);
    expect(await totp.totpEnabled(userId)).toBe(true);

    // Verificación de login: válido / inválido / formato raro.
    const loginCode = await generate({ secret: setup!.secret });
    expect(await totp.verifyUserTotp(userId, loginCode)).toBe(true);
    expect(await totp.verifyUserTotp(userId, '123')).toBe(false);
    expect(await totp.verifyUserTotp(userId, 'abcdef')).toBe(false);

    // Desactivar exige código válido (formato incorrecto: rechazado seguro).
    expect(await totp.disableTotp(userId, '12345')).toBe(false);
    expect(await totp.totpEnabled(userId)).toBe(true);
    const disableCode = await generate({ secret: setup!.secret });
    expect(await totp.disableTotp(userId, disableCode)).toBe(true);
    expect(await totp.totpEnabled(userId)).toBe(false);

    const after = getDb()
      .prepare('SELECT totp_secret FROM users WHERE id = ?')
      .get(userId) as { totp_secret: string | null };
    expect(after.totp_secret).toBeNull();
  });

  it('sin secreto guardado nada verifica', async () => {
    expect(await totp.verifyUserTotp(userId, '123456')).toBe(false);
    expect(await totp.verifyUserTotp('usuario-inexistente', '123456')).toBe(false);
  });
});
