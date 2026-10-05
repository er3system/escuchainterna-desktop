import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Consultorios F3: la vista institucional del maestro (listInstitutionalPatients) muestra
 * el consultorio de cada paciente DERIVADO del dueño (sin columna en patients) y permite
 * filtrar por consultorio. Un paciente retenido (dueño sin consultorio) sale sin consultorio.
 * Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-inst-cons-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let listInstitutionalPatients: typeof import('@/app/organizacion/orgData')['listInstitutionalPatients'];

const ORG = `org-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const OWNER_A = `ownerA-${randomUUID()}`;
const OWNER_B = `ownerB-${randomUUID()}`;
const MASTER = `master-${randomUUID()}`;

const P_A = randomUUID(); // dueño en consultorio A
const P_B = randomUUID(); // dueño en consultorio B
const P_HELD = randomUUID(); // retenido (dueño master, sin consultorio)

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ listInstitutionalPatients } = await import('@/app/organizacion/orgData'));

  const db = getDb();
  const now = new Date().toISOString();

  const insertUser = (id: string, role: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, 'activo')`,
      )
      .run(id, `${id}@demo.test`, now, role);
  insertUser(OWNER_A, 'psychologist');
  insertUser(OWNER_B, 'psychologist');
  insertUser(MASTER, 'org_master');

  db.prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Uni', ?, ?)`).run(
    ORG,
    `slug-${randomUUID()}`,
    now,
  );

  db.prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, 'Sede A', ?, 0)`)
    .run(C_A, ORG, now);
  db.prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, 'Sede B', ?, 0)`)
    .run(C_B, ORG, now);

  const insertMember = (user: string, role: string, consultorio: string | null) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, ?, '{}', ?, ?)`,
      )
      .run(randomUUID(), ORG, user, role, now, consultorio);
  insertMember(OWNER_A, 'psychologist', C_A);
  insertMember(OWNER_B, 'psychologist', C_B);
  insertMember(MASTER, 'master', null);

  const insertPatient = (id: string, owner: string) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, ?, '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, `Paciente ${id.slice(0, 4)}`, now, owner, ORG);
  insertPatient(P_A, OWNER_A);
  insertPatient(P_B, OWNER_B);
  insertPatient(P_HELD, MASTER);
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

describe('listInstitutionalPatients · consultorio derivado del dueño (F3)', () => {
  it('sin filtro: lista todos con su consultorio (o null si el dueño no tiene)', async () => {
    const all = await listInstitutionalPatients(ORG);
    const byId = new Map(all.map((p) => [p.patientId, p]));
    expect(byId.get(P_A)?.consultorioName).toBe('Sede A');
    expect(byId.get(P_B)?.consultorioName).toBe('Sede B');
    expect(byId.get(P_HELD)?.consultorioName).toBeNull();
    expect(byId.get(P_HELD)?.consultorioId).toBeNull();
  });

  it('filtro por consultorio A: solo los pacientes de dueños del consultorio A', async () => {
    const onlyA = (await listInstitutionalPatients(ORG, C_A)).map((p) => p.patientId);
    expect(onlyA).toContain(P_A);
    expect(onlyA).not.toContain(P_B);
    expect(onlyA).not.toContain(P_HELD);
  });

  it('filtro por consultorio B: solo los del B', async () => {
    const onlyB = (await listInstitutionalPatients(ORG, C_B)).map((p) => p.patientId);
    expect(onlyB).toEqual([P_B]);
  });
});
