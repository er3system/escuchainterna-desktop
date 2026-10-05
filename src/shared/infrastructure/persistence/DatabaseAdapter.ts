/**
 * Puerto de base de datos ASÍNCRONO — la frontera que desacopla la aplicación
 * del motor concreto.
 *
 * `node:sqlite` (el motor de desarrollo/tests) es **síncrono**; cualquier base de
 * datos de red —Postgres en producción— es **asíncrona** y no existe driver
 * síncrono. Por eso el contrato es async de raíz: así una misma firma sirve para
 * el `SqliteAdapter` (que envuelve el motor síncrono y resuelve de inmediato) y,
 * más adelante, para el `PostgresAdapter` (Fase 0d) sin tocar repos ni casos de uso.
 *
 * Convención de placeholders: los repos escriben SIEMPRE con `?` posicionales
 * (estilo SQLite). Cada implementación normaliza al dialecto de su motor — el
 * `PostgresAdapter` traducirá `?` → `$n`. El cifrado at-rest, el blind index y la
 * lógica `afterCommit` son de nivel aplicación y portan sin cambio.
 */

/** Valores que aceptan tanto `node:sqlite` como `pg` como parámetros enlazados. */
export type SqlParam = string | number | bigint | null | Uint8Array;

export interface DatabaseAdapter {
  /** Ejecuta una consulta y devuelve TODAS las filas (vacío si no hay). */
  query<Row = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<Row[]>;

  /** Devuelve la PRIMERA fila, o `null` si la consulta no arroja ninguna. */
  queryRow<Row = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<Row | null>;

  /** Ejecuta una sentencia de escritura (INSERT/UPDATE/DELETE/DDL) sin devolver filas. */
  execute(sql: string, params?: SqlParam[]): Promise<void>;

  /**
   * Corre `fn` dentro de UNA transacción (atómica: o todo o nada). La implementación
   * debe proteger los flujos check-then-write de carreras entre escritores (SQLite lo
   * hace con BEGIN IMMEDIATE; Postgres, con SERIALIZABLE). Los efectos registrados con
   * `afterCommit()` durante `fn` se ejecutan tras el COMMIT y se descartan ante ROLLBACK.
   * No anidar (es la frontera de transacción del caso de uso).
   */
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;

  /**
   * Registra un efecto para ejecutarse DESPUÉS del COMMIT de la transacción en
   * curso (p. ej. enviar un correo real solo si hubo COMMIT). Sin transacción
   * activa, se ejecuta de inmediato.
   */
  afterCommit(effect: () => void): void;
}
