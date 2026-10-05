import type { DatabaseAdapter, SqlParam } from './DatabaseAdapter';
import {
  getDb,
  withTransactionAsync,
  afterCommit as afterCommitEffect,
} from './SqliteConnection';
import { getPostgresAdapter } from './PostgresAdapter';

/**
 * Implementación del puerto {@link DatabaseAdapter} sobre `node:sqlite` (síncrono).
 *
 * Envuelve la conexión única `getDb()` y expone la interfaz async resolviendo de
 * inmediato: así el MISMO code-path (ya async) corre en dev/tests con SQLite hoy y
 * contra Postgres mañana (`PostgresAdapter`, Fase 0d). Las transacciones y la cola
 * `afterCommit` delegan en `SqliteConnection` —fuente única de verdad— para no
 * abrir dos transacciones en paralelo sobre la misma conexión.
 */
class SqliteAdapter implements DatabaseAdapter {
  public async query<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row[]> {
    return getDb().prepare(sql).all(...params) as unknown as Row[];
  }

  public async queryRow<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row | null> {
    const row = getDb().prepare(sql).get(...params) as Row | undefined;
    return row ?? null;
  }

  public async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    getDb().prepare(sql).run(...params);
  }

  public transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    return withTransactionAsync(fn);
  }

  public afterCommit(effect: () => void): void {
    afterCommitEffect(effect);
  }
}

/**
 * Cacheado en `globalThis` para sobrevivir al HMR de Next (igual que `getDb()`).
 */
const globalForAdapter = globalThis as unknown as { __escuchainternaDbAdapter?: DatabaseAdapter };

/**
 * Devuelve el adaptador de base de datos del entorno. Selección por env: con
 * `DATABASE_URL` presente → `PostgresAdapter` (producción/escala); sin él →
 * `SqliteAdapter` (desarrollo y los 944 tests). Punto único de cambio de motor.
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (globalForAdapter.__escuchainternaDbAdapter) return globalForAdapter.__escuchainternaDbAdapter;
  const adapter: DatabaseAdapter = process.env.DATABASE_URL
    ? getPostgresAdapter()
    : new SqliteAdapter();
  globalForAdapter.__escuchainternaDbAdapter = adapter;
  return adapter;
}
