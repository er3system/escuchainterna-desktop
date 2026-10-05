import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './migrations';
import { runSeed } from './seed';
import { encryptExistingClinicalData } from './clinicalEncryption';
import { encryptExistingIntegrationConfigs } from './integrationConfigEncryption';

/**
 * Conexión única a SQLite (node:sqlite, sin dependencias nativas).
 * Se cachea en globalThis para sobrevivir al HMR de Next en desarrollo.
 */
const globalForDb = globalThis as unknown as { __escuchainternaDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb.__escuchainternaDb) return globalForDb.__escuchainternaDb;

  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/escuchainterna.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  // Espera ante un lock en vez de fallar de inmediato: en dev, Next puede cold-startar
  // getDb en varios hilos/procesos a la vez; sin esto, dos escrituras concurrentes (p.ej.
  // el seed) chocan. Combinado con BEGIN IMMEDIATE en el seed evita siembras duplicadas.
  db.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(db);
  runSeed(db);
  encryptExistingClinicalData(db);
  encryptExistingIntegrationConfigs(db);

  globalForDb.__escuchainternaDb = db;
  return db;
}

/**
 * Cola de efectos a ejecutar DESPUÉS de que confirme la transacción en curso (p. ej. enviar
 * un correo REAL solo si hubo COMMIT). Es non-null mientras hay una transacción activa.
 */
let afterCommitQueue: Array<() => void> | null = null;

/**
 * Registra un efecto colateral para ejecutarse DESPUÉS del COMMIT de la transacción actual.
 * Si la transacción hace ROLLBACK, el efecto NO ocurre (p. ej. no se manda un correo de una
 * reserva que no se creó). Si NO hay transacción activa, se ejecuta de inmediato.
 */
export function afterCommit(fn: () => void): void {
  if (afterCommitQueue) afterCommitQueue.push(fn);
  else fn();
}

/**
 * Ejecuta `fn` dentro de UNA transacción (BEGIN/COMMIT, ROLLBACK ante error). Hace
 * atómicas las operaciones multi-escritura como la reasignación (mover owner_user_id
 * + asignación) y el offboarding (reasignar cartera + desactivar): o todo o nada, sin
 * estados intermedios que rompan el invariante. No anidar (SQLite no soporta BEGIN
 * dentro de BEGIN): es la frontera de transacción a nivel de acción/caso de uso.
 *
 * Los efectos registrados con afterCommit() durante `fn` se ejecutan tras el COMMIT (y se
 * descartan si hay ROLLBACK).
 */
export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  const previousQueue = afterCommitQueue;
  afterCommitQueue = [];
  let result: T;
  // BEGIN IMMEDIATE (no el BEGIN/DEFERRED por defecto): adquiere el WRITE lock al ABRIR la
  // transacción, no en la primera escritura. Así dos transacciones concurrentes se SERIALIZAN
  // (la 2ª espera hasta busy_timeout en vez de leer en paralelo) y se cierra la ventana TOCTOU
  // de "comprobar-y-luego-insertar" (p. ej. doble-reserva del mismo cupo): cuando la 2ª obtiene
  // el lock, su chequeo de solape ya ve la cita que confirmó la 1ª. Indispensable bajo el dev
  // multi-worker de Next y bajo dos reservas públicas simultáneas.
  db.exec('BEGIN IMMEDIATE');
  try {
    result = fn();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    afterCommitQueue = previousQueue; // descarta los efectos pendientes (no ocurrieron)
    throw error;
  }
  const queued = afterCommitQueue;
  afterCommitQueue = previousQueue;
  for (const effect of queued) {
    try {
      effect();
    } catch {
      /* un efecto post-commit nunca debe tumbar una acción ya confirmada */
    }
  }
  return result;
}

/**
 * Variante ASÍNCRONA de {@link withTransaction}: idéntica semántica (BEGIN
 * IMMEDIATE / COMMIT / ROLLBACK + cola `afterCommit`), pero `await`-ea `fn`.
 *
 * Es el motor de transacción del puerto async `DatabaseAdapter` durante la
 * re-plataforma a Postgres. Comparte la MISMA `afterCommitQueue` que la versión
 * síncrona —una sola fuente de verdad— para que código migrado (async) y sin
 * migrar (sync) nunca crean tener cada uno su propia transacción abierta sobre la
 * única conexión `node:sqlite`. No anidar (SQLite no soporta BEGIN dentro de BEGIN).
 *
 * Nota: con `node:sqlite` la transacción queda abierta a través del `await`; como
 * el bucle de eventos es de un solo hilo y hay UNA sola conexión, ningún otro
 * statement se intercala mientras `fn` resuelve sus promesas (que el SqliteAdapter
 * cumple de inmediato). El `PostgresAdapter` (Fase 0d) llevará su propia conexión
 * dedicada por transacción.
 */
export async function withTransactionAsync<T>(fn: () => Promise<T> | T): Promise<T> {
  const db = getDb();
  const previousQueue = afterCommitQueue;
  afterCommitQueue = [];
  let result: T;
  db.exec('BEGIN IMMEDIATE');
  try {
    result = await fn();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    afterCommitQueue = previousQueue; // descarta los efectos pendientes (no ocurrieron)
    throw error;
  }
  const queued = afterCommitQueue;
  afterCommitQueue = previousQueue;
  for (const effect of queued) {
    try {
      effect();
    } catch {
      /* un efecto post-commit nunca debe tumbar una acción ya confirmada */
    }
  }
  return result;
}
