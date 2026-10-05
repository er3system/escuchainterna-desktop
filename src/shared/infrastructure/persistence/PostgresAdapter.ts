import { Pool, types, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseAdapter, SqlParam } from './DatabaseAdapter';

/**
 * Implementación del puerto {@link DatabaseAdapter} sobre PostgreSQL (`pg.Pool`).
 * Es el motor de PRODUCCIÓN/escala de la re-plataforma; se selecciona cuando
 * `DATABASE_URL` está presente (ver `getDatabaseAdapter`). En desarrollo/tests
 * sigue usándose el `SqliteAdapter`.
 *
 * El SQL de la app ya es dialecto-neutro (placeholders `?`, `ON CONFLICT`,
 * `LOWER`, `substr`); aquí solo se traduce `?`→`$n` y se enrutan las
 * transacciones a una conexión dedicada del pool.
 */

// pg devuelve int8/bigint y numeric como STRING por defecto; en SQLite eran
// números. Normalizamos a number para que la hidratación (COUNT/SUM/saldos/
// contadores) reciba el mismo tipo que con SQLite y no haya que tocar repos.
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8 / bigint
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric

interface TxStore {
  client: PoolClient;
  afterCommitQueue: Array<() => void>;
}

/**
 * Conexión activa de la transacción en curso. Las llamadas a query/execute
 * dentro de `transaction(fn)` se enrutan a ESTE cliente (no a uno aleatorio del
 * pool), replicando la semántica de SQLite (una sola conexión por transacción).
 */
const txStorage = new AsyncLocalStorage<TxStore>();

/**
 * Traduce placeholders posicionales `?` → `$1, $2, …` (estilo Postgres),
 * respetando los literales entre comillas simples (incluido el `''` escapado),
 * para no tocar un `?` que viva dentro de una cadena.
 */
export function toPgPlaceholders(sql: string): string {
  let out = '';
  let n = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      inString = !inString;
      out += ch;
    } else if (ch === '?' && !inString) {
      n += 1;
      out += `$${n}`;
    } else {
      out += ch;
    }
  }
  return out;
}

export class PostgresAdapter implements DatabaseAdapter {
  public constructor(private readonly pool: Pool) {}

  /** El cliente de la transacción activa, o el pool (auto-adquiere conexión). */
  private runner(): Pool | PoolClient {
    return txStorage.getStore()?.client ?? this.pool;
  }

  public async query<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row[]> {
    const result = await this.runner().query(toPgPlaceholders(sql), params as unknown[]);
    return result.rows as Row[];
  }

  public async queryRow<Row = Record<string, unknown>>(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<Row | null> {
    const result = await this.runner().query(toPgPlaceholders(sql), params as unknown[]);
    return (result.rows[0] as Row | undefined) ?? null;
  }

  public async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    await this.runner().query(toPgPlaceholders(sql), params as unknown[]);
  }

  public async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    // Anidada: une a la transacción externa (SQLite tampoco anida BEGIN; el
    // caso de uso es la frontera única). Comparte la cola afterCommit del padre.
    if (txStorage.getStore()) return fn();

    const client = await this.pool.connect();
    const store: TxStore = { client, afterCommitQueue: [] };
    let result: T;
    try {
      // Los casos de uso hacen validaciones check-then-write (por ejemplo, detectar
      // solapes antes de reservar). READ COMMITTED permitiría que dos solicitudes
      // concurrentes validaran el mismo estado y confirmaran ambas. SERIALIZABLE
      // conserva la garantía que SQLite obtiene con BEGIN IMMEDIATE: ante esa carrera,
      // Postgres aborta una transacción en vez de persistir un estado inconsistente.
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      result = await txStorage.run(store, fn);
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* la conexión se descarta igual al liberar */
      }
      throw error;
    } finally {
      client.release();
    }
    for (const effect of store.afterCommitQueue) {
      try {
        effect();
      } catch {
        /* un efecto post-commit nunca debe tumbar una transacción confirmada */
      }
    }
    return result;
  }

  public afterCommit(effect: () => void): void {
    const store = txStorage.getStore();
    if (store) store.afterCommitQueue.push(effect);
    else effect();
  }

  /** Cierra el pool (para scripts/jobs; la app de larga vida no lo cierra). */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

let pool: Pool | undefined;
let adapter: PostgresAdapter | undefined;

const globalForPg = globalThis as unknown as {
  __escuchainternaPgPool?: Pool;
  __escuchainternaPgAdapter?: PostgresAdapter;
};

/**
 * Adaptador Postgres singleton (cacheado en globalThis para sobrevivir al HMR de
 * Next). Crea el `pg.Pool` perezosamente a partir de `DATABASE_URL`.
 */
/**
 * SSL según el destino. Los proveedores gestionados (Supabase, Neon, RDS…)
 * EXIGEN TLS; un Postgres local (dev/tests) no. La conexión va SIEMPRE cifrada
 * contra hosts remotos aunque la URL no traiga `sslmode`, para no depender de
 * que quien despliega lo recuerde (una URL sin sslmode caería con error de
 * conexión en producción). `sslmode=disable` en la URL fuerza sin-SSL.
 *
 * `rejectUnauthorized: false` cifra el tráfico pero NO verifica el certificado
 * del servidor (el pooler de Supabase no presenta una cadena verificable por
 * defecto). Endurecimiento futuro ("pulir integraciones"): fijar la CA del
 * proyecto con `ssl: { ca, rejectUnauthorized: true }`.
 */
function sslForConnection(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (/[?&]sslmode=disable\b/.test(connectionString)) return undefined;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|::1)[:/]/.test(connectionString);
  if (isLocal && !/[?&]sslmode=require\b/.test(connectionString)) return undefined;
  return { rejectUnauthorized: false };
}

export function getPostgresAdapter(): PostgresAdapter {
  if (globalForPg.__escuchainternaPgAdapter) return globalForPg.__escuchainternaPgAdapter;
  if (adapter) return adapter;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definido: no se puede crear el PostgresAdapter.');
  }
  pool = new Pool({ connectionString, ssl: sslForConnection(connectionString) });
  adapter = new PostgresAdapter(pool);
  globalForPg.__escuchainternaPgPool = pool;
  globalForPg.__escuchainternaPgAdapter = adapter;
  return adapter;
}
