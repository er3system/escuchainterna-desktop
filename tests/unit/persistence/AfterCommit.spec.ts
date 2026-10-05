import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * afterCommit (CANAL2): los efectos colaterales (p. ej. envío real de correo) se ejecutan
 * solo DESPUÉS de que la transacción confirme; si hay ROLLBACK no ocurren; fuera de una
 * transacción se ejecutan de inmediato. BD SQLite real en directorio temporal.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-aftercommit-'));
// Debe fijarse ANTES de importar el módulo (getDb resuelve la ruta al primer uso).
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

let withTransaction: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['withTransaction'];
let afterCommit: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['afterCommit'];

beforeAll(async () => {
  const mod = await import('@/shared/infrastructure/persistence/SqliteConnection');
  withTransaction = mod.withTransaction;
  afterCommit = mod.afterCommit;
  mod.getDb(); // inicializa migraciones/seed sobre la BD temporal
});

describe('afterCommit', () => {
  it('fuera de transacción se ejecuta de inmediato', () => {
    let ran = false;
    afterCommit(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('dentro de withTransaction corre DESPUÉS del commit (y de que fn retorne)', () => {
    const order: string[] = [];
    withTransaction(() => {
      afterCommit(() => order.push('after-commit'));
      order.push('cuerpo');
    });
    expect(order).toEqual(['cuerpo', 'after-commit']);
  });

  it('si la transacción hace ROLLBACK, el efecto NO ocurre', () => {
    let ran = false;
    expect(() =>
      withTransaction(() => {
        afterCommit(() => {
          ran = true;
        });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(ran).toBe(false);
  });
});
