import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Habeas data (Ley 1581) con salvaguarda de retención: countClinicalData detecta
 * datos clínicos (que BLOQUEAN el borrado) y purgeAccountData elimina por completo
 * la cuenta y sus datos cuando es seguro hacerlo.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-purge-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let countClinicalData: typeof import('@/shared/infrastructure/account-data/AccountDataPurge')['countClinicalData'];
let purgeAccountData: typeof import('@/shared/infrastructure/account-data/AccountDataPurge')['purgeAccountData'];

const conDatos = `con-datos-${randomUUID()}`;
const sinDatos = `sin-datos-${randomUUID()}`;
const conPago = `con-pago-${randomUUID()}`;
const conNotas = `con-notas-${randomUUID()}`;
const subConPago = randomUUID();
const hiloSinDatos = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ countClinicalData, purgeAccountData } = await import(
    '@/shared/infrastructure/account-data/AccountDataPurge'
  ));

  const db = getDb();
  const now = new Date().toISOString();
  for (const [id, email] of [
    [conDatos, 'con-datos@spec.test'],
    [sinDatos, 'sin-datos@spec.test'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', 'psychologist', 'activo', ?)`,
    ).run(id, email, now);
    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, created_at)
       VALUES (?, ?, 'profesional', 'activa', ?, ?)`,
    ).run(randomUUID(), id, now, now);
  }

  // La cuenta "con datos" tiene un paciente (dato clínico → bloquea el borrado).
  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente', ?, ?)`,
  ).run(randomUUID(), now, conDatos);

  // La cuenta "sin datos" tiene solo datos NO clínicos (preferencia + notificación).
  db.prepare(
    `INSERT INTO user_preferences (owner_user_id, key, value, updated_at) VALUES (?, 'k', 'v', ?)`,
  ).run(sinDatos, now);
  db.prepare(
    `INSERT INTO notifications (id, recipient_user_id, kind, title, body, created_at)
     VALUES (?, ?, 'novedad', 'Hola', '', ?)`,
  ).run(randomUUID(), sinDatos, now);
  // ...y un hilo del asistente con un mensaje: ai_chat_messages cuelga por thread_id (sin
  // owner_user_id), así que el sweep genérico NO lo alcanza; la purga debe borrarlo explícitamente
  // o quedaría dato clínico cifrado residual tras la supresión de cuenta (Ley 1581).
  db.prepare(
    `INSERT INTO ai_chat_threads (id, owner_user_id, title, patient_id, created_at, updated_at)
     VALUES (?, ?, 'Hilo', NULL, ?, ?)`,
  ).run(hiloSinDatos, sinDatos, now, now);
  db.prepare(
    `INSERT INTO ai_chat_messages (id, thread_id, role, content, created_at)
     VALUES (?, ?, 'usuario', 'mensaje', ?)`,
  ).run(randomUUID(), hiloSinDatos, now);

  // La cuenta "con pago" tiene suscripción + un pago: subscription_payments tiene FK
  // enforced a subscriptions(id), así que el purge debe borrar el pago ANTES (P0).
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at)
     VALUES (?, 'con-pago@spec.test', 'hash', 'psychologist', 'activo', ?)`,
  ).run(conPago, now);
  db.prepare(
    `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, created_at)
     VALUES (?, ?, 'profesional', 'activa', ?, ?)`,
  ).run(subConPago, conPago, now, now);
  db.prepare(
    `INSERT INTO subscription_payments (id, subscription_id, amount, currency, provider, paid_at)
     VALUES (?, ?, 90000, 'COP', 'simulado', ?)`,
  ).run(randomUUID(), subConPago, now);

  // La cuenta "con notas" tiene SOLO bitácora privada + un cuestionario aplicado, sin
  // patients (simula un huérfano post-offboarding): la salvaguarda debe contarlos (P1).
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at)
     VALUES (?, 'con-notas@spec.test', 'hash', 'psychologist', 'activo', ?)`,
  ).run(conNotas, now);
  db.prepare(
    `INSERT INTO patient_notes (id, owner_user_id, patient_id, body, created_at) VALUES (?, ?, 'p1', 'nota', ?)`,
  ).run(randomUUID(), conNotas, now);
  db.prepare(
    `INSERT INTO patient_assessments (id, owner_user_id, patient_id, instrument_id, answers_json, total_score, severity, risk_flag, notes, applied_at)
     VALUES (?, ?, 'p1', 'phq-9', '[]', 12, 'Moderada', 0, '', ?)`,
  ).run(randomUUID(), conNotas, now);
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

describe('AccountDataPurge (habeas data con salvaguarda)', () => {
  it('countClinicalData detecta los datos clínicos que bloquean el borrado', async () => {
    const conDatosCount = await countClinicalData(conDatos);
    expect(conDatosCount.patients).toBe(1);
    expect(conDatosCount.total).toBeGreaterThan(0);

    const sinDatosCount = await countClinicalData(sinDatos);
    expect(sinDatosCount.total).toBe(0);
  });

  it('purgeAccountData elimina la cuenta y TODOS sus datos cuando es seguro', async () => {
    const db = getDb();
    const exists = (sql: string, ...p: string[]) =>
      ((db.prepare(sql).get(...p) as { n: number }).n);

    // Antes: la cuenta y sus datos existen.
    expect(exists('SELECT COUNT(*) AS n FROM users WHERE id = ?', sinDatos)).toBe(1);
    expect(exists('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?', sinDatos)).toBe(1);
    expect(exists('SELECT COUNT(*) AS n FROM user_preferences WHERE owner_user_id = ?', sinDatos)).toBe(1);
    expect(exists('SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ?', sinDatos)).toBe(1);
    expect(exists('SELECT COUNT(*) AS n FROM ai_chat_threads WHERE owner_user_id = ?', sinDatos)).toBe(1);
    expect(exists('SELECT COUNT(*) AS n FROM ai_chat_messages WHERE thread_id = ?', hiloSinDatos)).toBe(1);

    await purgeAccountData(sinDatos);

    // Después: nada queda.
    expect(exists('SELECT COUNT(*) AS n FROM users WHERE id = ?', sinDatos)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?', sinDatos)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM user_preferences WHERE owner_user_id = ?', sinDatos)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ?', sinDatos)).toBe(0);
    // El hilo del asistente Y sus mensajes (que cuelgan por thread_id) quedan suprimidos.
    expect(exists('SELECT COUNT(*) AS n FROM ai_chat_threads WHERE owner_user_id = ?', sinDatos)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM ai_chat_messages WHERE thread_id = ?', hiloSinDatos)).toBe(0);

    // La otra cuenta sigue intacta.
    expect(exists('SELECT COUNT(*) AS n FROM users WHERE id = ?', conDatos)).toBe(1);
  });

  it('purga una cuenta con pagos de suscripción sin reventar por la FK (P0)', async () => {
    const db = getDb();
    const exists = (sql: string, ...p: string[]) => (db.prepare(sql).get(...p) as { n: number }).n;

    expect(exists('SELECT COUNT(*) AS n FROM subscription_payments WHERE subscription_id = ?', subConPago)).toBe(1);

    // Antes del fix esto lanzaba SQLITE_CONSTRAINT_FOREIGNKEY al borrar subscriptions.
    await expect(purgeAccountData(conPago)).resolves.not.toThrow();

    expect(exists('SELECT COUNT(*) AS n FROM users WHERE id = ?', conPago)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?', conPago)).toBe(0);
    expect(exists('SELECT COUNT(*) AS n FROM subscription_payments WHERE subscription_id = ?', subConPago)).toBe(0);
  });

  it('countClinicalData cuenta notas privadas y cuestionarios como dato bajo retención (P1)', async () => {
    const count = await countClinicalData(conNotas);
    expect(count.privateNotes).toBe(1);
    expect(count.assessments).toBe(1);
    // total > 0 ⇒ la salvaguarda BLOQUEA el borrado aunque no haya patients.
    expect(count.total).toBeGreaterThanOrEqual(2);
  });
});
