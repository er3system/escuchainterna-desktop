import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Cascada de continuidad (§1.2): al reasignar, el owner_user_id del paciente Y de
 * TODO su dato (clínico + operativo) se mueve al nuevo tratante. Los casos relacionales
 * (case_members) se EXCLUYEN (multi-paciente). Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-cascade-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqlitePatientOwnerWriter: typeof import('@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter')['SqlitePatientOwnerWriter'];

const ORG = `org-${randomUUID()}`;
const TRATANTE_A = `a-${randomUUID()}`;
const TRATANTE_B = `b-${randomUUID()}`;
const PATIENT = randomUUID();
const CASE_ID = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePatientOwnerWriter } = await import(
    '@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter'
  ));

  const db = getDb();
  const now = new Date().toISOString();
  // Paciente institucional de A.
  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id, organization_id) VALUES (?, ?, ?, ?, ?)`,
  ).run(PATIENT, 'Paciente Cascada', now, TRATANTE_A, ORG);
  // Contenido clínico y operativo, todo de A.
  db.prepare(
    `INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, status, diagnosed_at, owner_user_id) VALUES (?, ?, '6A70', 'Episodio depresivo', 'activo', ?, ?)`,
  ).run(randomUUID(), PATIENT, now, TRATANTE_A);
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, created_at, updated_at, owner_user_id) VALUES (?, ?, 'Sesión 1', ?, ?, ?)`,
  ).run(randomUUID(), PATIENT, now, now, TRATANTE_A);
  db.prepare(
    `INSERT INTO clinical_records (id, patient_id, title, created_at, updated_at, owner_user_id) VALUES (?, ?, 'Historia', ?, ?, ?)`,
  ).run(randomUUID(), PATIENT, now, now, TRATANTE_A);
  db.prepare(
    `INSERT INTO patient_reports (id, patient_id, owner_user_id, title, created_at, updated_at) VALUES (?, ?, ?, 'Informe', ?, ?)`,
  ).run(randomUUID(), PATIENT, TRATANTE_A, now, now);
  // Caso relacional (multi-paciente): NO debe moverse en la reasignación individual.
  db.prepare(
    `INSERT INTO relational_cases (id, owner_user_id, title, created_at, updated_at) VALUES (?, ?, 'Pareja', ?, ?)`,
  ).run(CASE_ID, TRATANTE_A, now, now);
  db.prepare(
    `INSERT INTO case_members (id, case_id, patient_id, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), CASE_ID, PATIENT, TRATANTE_A, now);
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

function ownerOf(table: string, where: string, ...params: string[]): string | null {
  const row = getDb()
    .prepare(`SELECT owner_user_id FROM ${table} WHERE ${where} LIMIT 1`)
    .get(...params) as { owner_user_id: string } | undefined;
  return row?.owner_user_id ?? null;
}

describe('SqlitePatientOwnerWriter — cascada de continuidad', () => {
  it('mueve el dueño del paciente Y de todo su dato clínico/operativo', async () => {
    const moved = await new SqlitePatientOwnerWriter().setOwner(PATIENT, ORG, TRATANTE_B);
    expect(moved).toBe(true);

    // El nuevo tratante (B) es dueño del paciente y de su contenido.
    expect(ownerOf('patients', 'id = ?', PATIENT)).toBe(TRATANTE_B);
    expect(ownerOf('diagnoses', 'patient_id = ?', PATIENT)).toBe(TRATANTE_B);
    expect(ownerOf('session_notes', 'patient_id = ?', PATIENT)).toBe(TRATANTE_B);
    expect(ownerOf('clinical_records', 'patient_id = ?', PATIENT)).toBe(TRATANTE_B);
    expect(ownerOf('patient_reports', 'patient_id = ?', PATIENT)).toBe(TRATANTE_B);
  });

  it('NO mueve el caso relacional (multi-paciente): sigue siendo de A', () => {
    expect(ownerOf('case_members', 'patient_id = ?', PATIENT)).toBe(TRATANTE_A);
    expect(ownerOf('relational_cases', 'id = ?', CASE_ID)).toBe(TRATANTE_A);
  });

  it('no reasigna si el paciente no es de la organización', async () => {
    expect(await new SqlitePatientOwnerWriter().setOwner(PATIENT, 'org-otra', TRATANTE_A)).toBe(false);
    // Sigue siendo de B (no se tocó nada).
    expect(ownerOf('patients', 'id = ?', PATIENT)).toBe(TRATANTE_B);
  });
});
