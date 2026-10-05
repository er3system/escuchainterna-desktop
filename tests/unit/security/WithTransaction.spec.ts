import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * withTransaction hace atómicas las operaciones multi-escritura (reasignación,
 * offboarding): commit si todo va bien, ROLLBACK ante cualquier error.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-tx-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let withTransaction: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['withTransaction'];

const patientId = randomUUID();

function logCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM record_access_log WHERE patient_id = ?').get(patientId) as { n: number }).n;
}

function insert(action: string): void {
  getDb()
    .prepare(
      `INSERT INTO record_access_log (id, actor_user_id, patient_id, area, action, created_at)
       VALUES (?, 'actor', ?, 'resumen', ?, ?)`,
    )
    .run(randomUUID(), patientId, action, new Date().toISOString());
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  ({ getDb, withTransaction } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
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

describe('withTransaction', () => {
  it('commitea ambas escrituras cuando todo va bien', () => {
    expect(logCount()).toBe(0);
    withTransaction(() => {
      insert('uno');
      insert('dos');
    });
    expect(logCount()).toBe(2);
  });

  it('hace ROLLBACK de TODAS las escrituras si algo falla (atomicidad)', () => {
    const before = logCount();
    expect(() =>
      withTransaction(() => {
        insert('tres'); // se escribe…
        throw new Error('falla a media transacción'); // …pero la transacción aborta
      }),
    ).toThrow('falla a media transacción');
    // El insert 'tres' se revirtió: el conteo no cambió.
    expect(logCount()).toBe(before);
  });
});
