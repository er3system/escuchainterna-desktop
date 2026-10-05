import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Evidencia (citas + huecos) sobre el retriever SQLite REAL, acotado por
 * owner_user_id. Reusa el patrón de AssistantOwnerScoping.spec.ts (BD temporal,
 * dos dueños). Verifica: (1) con 1 nota y sin diagnóstico, la nota es fuente y
 * "No hay un diagnóstico CIE-11 registrado." es hueco; (2) el retriever no
 * cruza dueños, así que la evidencia jamás incluye datos ajenos.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-evidence-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let getDatabaseAdapter: typeof import('@/shared/infrastructure/persistence/SqliteAdapter')['getDatabaseAdapter'];
let SqlitePatientContextRetriever: typeof import('@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever')['SqlitePatientContextRetriever'];
let contextToEvidence: typeof import('@/contexts/assistant/domain/caseEvidence')['contextToEvidence'];

/** Gate permisivo: este test verifica la EVIDENCIA del caso, no el consentimiento-IA. */
const consintiente = { isAuthorized: async () => true };

const ownerA = `owner-a-${randomUUID()}`;
const ownerB = `owner-b-${randomUUID()}`;
const patientA = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ getDatabaseAdapter } = await import('@/shared/infrastructure/persistence/SqliteAdapter'));
  ({ SqlitePatientContextRetriever } = await import(
    '@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever'
  ));
  ({ contextToEvidence } = await import('@/contexts/assistant/domain/caseEvidence'));

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare('INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)').run(
    patientA,
    'Paciente De Ana',
    now,
    ownerA,
  );

  // 1 nota del dueño A, SIN diagnóstico, SIN historia, SIN citas.
  db.prepare(
    'INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), patientA, 'Sesión 1', 'Avance notable de Ana.', now, now, ownerA);

  // Diagnóstico "envenenado": apunta al paciente de A pero pertenece a B.
  // El retriever de A NO debe verlo, así que el hueco del diagnóstico se mantiene.
  db.prepare(
    'INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, diagnosed_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), patientA, '6B00', 'Diagnóstico ajeno', now, ownerB);
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

describe('Evidencia del caso sobre el retriever real (owner-scoped)', () => {
  it('1 nota propia y sin diagnóstico propio: nota como fuente, diagnóstico como hueco', async () => {
    const context = await new SqlitePatientContextRetriever(ownerA, getDatabaseAdapter(), consintiente).retrieve(patientA);
    expect(context).not.toBeNull();

    const evidence = contextToEvidence(context!);

    expect(evidence.hasAnyEvidence).toBe(true);
    expect(evidence.sources).toHaveLength(1);
    expect(evidence.sources[0].kind).toBe('nota');
    expect(evidence.sources[0].label).toContain('Sesión 1');

    expect(evidence.gaps).toContain('No hay un diagnóstico CIE-11 registrado.');
    // El diagnóstico de B nunca cruzó: no aparece en ninguna fuente.
    expect(JSON.stringify(evidence)).not.toContain('Diagnóstico ajeno');
  });

  it('un dueño sin acceso al paciente no obtiene contexto (ni evidencia)', async () => {
    const context = await new SqlitePatientContextRetriever(ownerB).retrieve(patientA);
    expect(context).toBeNull();
  });
});
