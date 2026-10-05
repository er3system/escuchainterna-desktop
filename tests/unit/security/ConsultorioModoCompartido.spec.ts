import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * MODO SEDES (MS1): el modo de consultorios de la organización es un INTERRUPTOR del
 * aislamiento. En 'aislado' un miembro de un consultorio NO alcanza al de otro (F2/F4);
 * en 'compartido' los consultorios son sedes (etiquetas) y el aislamiento se APAGA — el
 * acceso lo rige la política de la org. Mismo setup, alternando el modo. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-modo-sedes-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolvePatientAccess: typeof import('@/shared/infrastructure/auth/patientAccess')['resolvePatientAccess'];
let createPatientShare: typeof import('@/shared/infrastructure/auth/patientShares')['createPatientShare'];
let SqliteSupervisorReader: typeof import('@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader')['SqliteSupervisorReader'];

const ORG = `org-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const PROF_A = `profA-${randomUUID()}`; // consultorio A, dueño del paciente
const PROF_B = `profB-${randomUUID()}`; // consultorio B (el "intruso")
const P_INST_A = randomUUID(); // institucional, dueño PROF_A
const P_PART_A = randomUUID(); // particular (org NULL), dueño PROF_A — para el share

function setMode(mode: 'aislado' | 'compartido') {
  getDb().prepare('UPDATE organizations SET consultorio_mode = ? WHERE id = ?').run(mode, ORG);
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolvePatientAccess } = await import('@/shared/infrastructure/auth/patientAccess'));
  ({ createPatientShare } = await import('@/shared/infrastructure/auth/patientShares'));
  ({ SqliteSupervisorReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader'
  ));

  const db = getDb();
  const now = new Date().toISOString();
  const insertUser = (id: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, 'psychologist', 'activo')`,
      )
      .run(id, `${id}@demo.test`, now);
  insertUser(PROF_A);
  insertUser(PROF_B);

  // Org con política COBERTURA (cualquier miembro abriría cualquier expediente… salvo el
  // aislamiento de consultorio, que es justo lo que conmuta el modo). Empieza en 'aislado'.
  db.prepare(
    `INSERT INTO organizations (id, name, slug, created_at, access_policy, patient_ownership, professor_can_widen, consultorio_mode)
     VALUES (?, 'Org', ?, ?, 'cobertura', 'institucion', 0, 'aislado')`,
  ).run(ORG, `slug-${randomUUID()}`, now);

  for (const id of [C_A, C_B]) {
    db.prepare(
      `INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`,
    ).run(id, ORG, id, now);
  }
  const insertMember = (user: string, consultorio: string) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, 'psychologist', '{}', ?, ?)`,
      )
      .run(randomUUID(), ORG, user, now, consultorio);
  insertMember(PROF_A, C_A);
  insertMember(PROF_B, C_B);

  const insertPatient = (id: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, 'Paciente', '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, now, owner, org);
  insertPatient(P_INST_A, PROF_A, ORG);
  insertPatient(P_PART_A, PROF_A, null);

  // Vínculo de supervisión cross-consultorio: PROF_A (A) supervisa a PROF_B (B).
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, '{"notas":true,"historias":true,"pagos":false}', ?)`,
  ).run(randomUUID(), ORG, PROF_A, PROF_B, now);
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

describe('Modo de consultorios como interruptor del aislamiento (MS1)', () => {
  it('COBERTURA: aislado bloquea cross-consultorio; compartido lo permite', async () => {
    setMode('aislado');
    expect(await resolvePatientAccess(PROF_B, P_INST_A)).toBeNull();
    setMode('compartido');
    expect((await resolvePatientAccess(PROF_B, P_INST_A))?.mode).toBe('coverage');
    setMode('aislado'); // restaura para el resto
    expect(await resolvePatientAccess(PROF_B, P_INST_A)).toBeNull();
  });

  it('COMPARTIR: un share cross-consultorio no concede en aislado, sí en compartido', async () => {
    await createPatientShare({
      patientId: P_PART_A,
      ownerUserId: PROF_A,
      granteeUserId: PROF_B,
      organizationId: ORG,
      createdBy: PROF_A,
    });
    setMode('aislado');
    expect(await resolvePatientAccess(PROF_B, P_PART_A)).toBeNull();
    setMode('compartido');
    expect((await resolvePatientAccess(PROF_B, P_PART_A))?.mode).toBe('share');
    setMode('aislado');
  });

  it('SUPERVISIÓN: supervisesActive cross-consultorio es false en aislado, true en compartido', async () => {
    const reader = new SqliteSupervisorReader();
    setMode('aislado');
    expect(await reader.supervisesActive(PROF_A, PROF_B, ORG)).toBe(false);
    setMode('compartido');
    expect(await reader.supervisesActive(PROF_A, PROF_B, ORG)).toBe(true);
    setMode('aislado');
  });
});
