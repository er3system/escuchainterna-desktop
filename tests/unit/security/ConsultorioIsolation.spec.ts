import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Aislamiento de CONSULTORIOS (docs/consultorios-spec.md §3, Fase 2). Un profesor del
 * consultorio A NO debe alcanzar el expediente de un paciente del consultorio B de la
 * MISMA organización, ni por cobertura ni por un share. El org_master (sin consultorio)
 * ve todo; una org sin consultorios (todo NULL) se comporta como antes. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-consultorio-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolvePatientAccess: typeof import('@/shared/infrastructure/auth/patientAccess')['resolvePatientAccess'];
let createPatientShare: typeof import('@/shared/infrastructure/auth/patientShares')['createPatientShare'];
let listShareableColleagues: typeof import('@/app/(app)/pacientes/[id]/ajustes/sharing')['listShareableColleagues'];

const ORG = `org-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;

const MASTER = `master-${randomUUID()}`; // sin consultorio → ve todo
const PROF_A = `profA-${randomUUID()}`; // consultorio A, dueño del paciente institucional
const COLEGA_A = `colA-${randomUUID()}`; // consultorio A
const PROF_B = `profB-${randomUUID()}`; // consultorio B → debe quedar aislado

const OWNER_PLANO = `plano-own-${randomUUID()}`; // org sin consultorio (retrocompat)
const ACTOR_PLANO = `plano-act-${randomUUID()}`;

const P_INST_A = randomUUID(); // institucional, dueño PROF_A (consultorio A)
const P_PART_A = randomUUID(); // particular (org NULL), dueño PROF_A — para probar el share
const P_INST_PLANO = randomUUID(); // institucional sin consultorio (retrocompat)

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolvePatientAccess } = await import('@/shared/infrastructure/auth/patientAccess'));
  ({ createPatientShare } = await import('@/shared/infrastructure/auth/patientShares'));
  ({ listShareableColleagues } = await import('@/app/(app)/pacientes/[id]/ajustes/sharing'));

  const db = getDb();
  const now = new Date().toISOString();

  const insertUser = (id: string, role: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, 'activo')`,
      )
      .run(id, `${id}@demo.test`, now, role);
  insertUser(MASTER, 'org_master');
  insertUser(PROF_A, 'psychologist');
  insertUser(COLEGA_A, 'psychologist');
  insertUser(PROF_B, 'psychologist');
  insertUser(OWNER_PLANO, 'psychologist');
  insertUser(ACTOR_PLANO, 'psychologist');

  // Org con política COBERTURA (cualquier miembro abriría cualquier expediente…
  // salvo por el aislamiento de consultorio que estamos probando).
  db.prepare(
    `INSERT INTO organizations (id, name, slug, created_at, access_policy, patient_ownership, professor_can_widen)
     VALUES (?, 'Org', ?, ?, 'cobertura', 'institucion', 0)`,
  ).run(ORG, `slug-${randomUUID()}`, now);

  const insertConsultorio = (id: string) =>
    db
      .prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`)
      .run(id, ORG, id, now);
  insertConsultorio(C_A);
  insertConsultorio(C_B);

  const insertMember = (user: string, role: string, consultorio: string | null) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, ?, '{}', ?, ?)`,
      )
      .run(randomUUID(), ORG, user, role, now, consultorio);
  insertMember(MASTER, 'master', null);
  insertMember(PROF_A, 'psychologist', C_A);
  insertMember(COLEGA_A, 'psychologist', C_A);
  insertMember(PROF_B, 'psychologist', C_B);
  insertMember(OWNER_PLANO, 'psychologist', null); // org plana (sin consultorio)
  insertMember(ACTOR_PLANO, 'psychologist', null);

  const insertPatient = (id: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, 'Paciente', '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, now, owner, org);
  insertPatient(P_INST_A, PROF_A, ORG);
  insertPatient(P_PART_A, PROF_A, null);
  insertPatient(P_INST_PLANO, OWNER_PLANO, ORG);
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

describe('Consultorios · aislamiento por COBERTURA (§3)', () => {
  it('el dueño ve su propio paciente (owner)', async () => {
    expect((await resolvePatientAccess(PROF_A, P_INST_A))?.mode).toBe('owner');
  });

  it('un colega del MISMO consultorio (A) SÍ obtiene cobertura (política cobertura)', async () => {
    const access = await resolvePatientAccess(COLEGA_A, P_INST_A);
    expect(access).not.toBeNull();
    expect(access?.mode).toBe('coverage');
  });

  it('un profesor de OTRO consultorio (B) NO alcanza el paciente de A (null), pese a cobertura', async () => {
    expect(await resolvePatientAccess(PROF_B, P_INST_A)).toBeNull();
  });

  it('el org_master (sin consultorio) ve cualquier consultorio', async () => {
    expect(await resolvePatientAccess(MASTER, P_INST_A)).not.toBeNull();
  });
});

describe('Consultorios · aislamiento por COMPARTIR (§3)', () => {
  it('un share cross-consultorio (A→B) NO concede acceso (null)', async () => {
    await createPatientShare({
      patientId: P_PART_A,
      ownerUserId: PROF_A,
      granteeUserId: PROF_B,
      organizationId: ORG,
      createdBy: PROF_A,
    });
    expect(await resolvePatientAccess(PROF_B, P_PART_A)).toBeNull();
  });

  it('un share dentro del MISMO consultorio (A→colega de A) SÍ concede modo "share"', async () => {
    await createPatientShare({
      patientId: P_PART_A,
      ownerUserId: PROF_A,
      granteeUserId: COLEGA_A,
      organizationId: ORG,
      createdBy: PROF_A,
    });
    expect((await resolvePatientAccess(COLEGA_A, P_PART_A))?.mode).toBe('share');
  });
});

describe('Consultorios · desplegable de colegas (write-path)', () => {
  it('al dueño de A solo le ofrece colegas de A (o sin consultorio), nunca de B', async () => {
    const ids = (await listShareableColleagues(ORG, PROF_A)).map((c) => c.userId);
    expect(ids).toContain(COLEGA_A); // mismo consultorio
    expect(ids).toContain(MASTER); // sin consultorio (master)
    expect(ids).not.toContain(PROF_B); // OTRO consultorio → no se ofrece
  });
});

describe('Consultorios · retrocompatibilidad (org sin consultorios)', () => {
  it('dueño y actor sin consultorio (NULL) → la cobertura funciona como antes', async () => {
    const access = await resolvePatientAccess(ACTOR_PLANO, P_INST_PLANO);
    expect(access).not.toBeNull();
    expect(access?.mode).toBe('coverage');
  });
});
