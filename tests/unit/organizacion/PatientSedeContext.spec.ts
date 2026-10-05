import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * "Tratado en" del paciente (Modo Sedes, MS2): patientSedeContext devuelve las sedes y la
 * sede actual SOLO cuando la org del dueño está en modo 'compartido'; en 'aislado' (o sin
 * org) devuelve null y la ficha no muestra el campo. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-sede-ctx-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let patientSedeContext: typeof import('@/app/(app)/pacientes/[id]/sede')['patientSedeContext'];

const ORG = `org-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const OWNER = `own-${randomUUID()}`;
const P = randomUUID();

function setMode(mode: 'aislado' | 'compartido') {
  getDb().prepare('UPDATE organizations SET consultorio_mode = ? WHERE id = ?').run(mode, ORG);
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ patientSedeContext } = await import('@/app/(app)/pacientes/[id]/sede'));

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, 'psychologist', 'activo')`,
  ).run(OWNER, `${OWNER}@demo.test`, now);
  db.prepare(
    `INSERT INTO organizations (id, name, slug, created_at, consultorio_mode) VALUES (?, 'Org', ?, ?, 'compartido')`,
  ).run(ORG, `slug-${randomUUID()}`, now);
  for (const [id, name] of [[C_A, 'Sede Centro'], [C_B, 'Sede Norte']] as const) {
    db.prepare(
      `INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`,
    ).run(id, ORG, name, now);
  }
  db.prepare(
    `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
     VALUES (?, ?, ?, 'psychologist', '{}', ?, ?)`,
  ).run(randomUUID(), ORG, OWNER, now, C_A);
  db.prepare(
    `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id, consultorio_id)
     VALUES (?, 'Paciente', '', NULL, '', NULL, '[]', 0, ?, ?, ?, ?)`,
  ).run(P, now, OWNER, ORG, C_A);
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

describe('patientSedeContext (MS2)', () => {
  it('en modo compartido: devuelve las sedes y la sede actual del paciente', async () => {
    setMode('compartido');
    const ctx = await patientSedeContext(P, OWNER);
    expect(ctx).not.toBeNull();
    expect(ctx?.currentConsultorioId).toBe(C_A);
    expect(ctx?.currentConsultorioName).toBe('Sede Centro');
    expect(ctx?.consultorios.map((c) => c.name).sort()).toEqual(['Sede Centro', 'Sede Norte']);
  });

  it('en modo aislado: devuelve null (la ficha no muestra "Tratado en")', async () => {
    setMode('aislado');
    expect(await patientSedeContext(P, OWNER)).toBeNull();
    setMode('compartido');
  });

  it('paciente sin sede: contexto presente pero sede actual null', async () => {
    getDb().prepare('UPDATE patients SET consultorio_id = NULL WHERE id = ?').run(P);
    const ctx = await patientSedeContext(P, OWNER);
    expect(ctx).not.toBeNull();
    expect(ctx?.currentConsultorioId).toBeNull();
    getDb().prepare('UPDATE patients SET consultorio_id = ? WHERE id = ?').run(C_A, P);
  });
});
