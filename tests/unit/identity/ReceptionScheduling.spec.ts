import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Núcleo de seguridad de F5b (consultorios-spec §5): una recepción solo puede agendar
 * para un profesional que ATIENDE (member_role 'psychologist'), activo, de la MISMA
 * organización y en uno de SUS consultorios. receptionCanScheduleFor es el gate puro
 * (recibe el alcance resuelto), probado contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-rec-sched-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let receptionCanScheduleFor: typeof import('@/app/(app)/recepcion/recepcionData')['receptionCanScheduleFor'];

const ORG = `org-${randomUUID()}`;
const OTHER_ORG = `org2-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const C_OTHER = `consX-${randomUUID()}`;

const PSY_A = `psyA-${randomUUID()}`; // psicólogo, consultorio A (destino válido para recepción de A)
const PSY_B = `psyB-${randomUUID()}`; // psicólogo, consultorio B
const PROF_A = `profA-${randomUUID()}`; // profesor (no atiende), consultorio A
const SUSP_A = `suspA-${randomUUID()}`; // psicólogo A pero suspendido
const PSY_OTHER = `psyX-${randomUUID()}`; // psicólogo de OTRA org
const C_ARCH = `consArch-${randomUUID()}`; // consultorio ARCHIVADO de ORG
const PSY_ARCH = `psyArch-${randomUUID()}`; // psicólogo activo en el consultorio archivado

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ receptionCanScheduleFor } = await import('@/app/(app)/recepcion/recepcionData'));

  const db = getDb();
  const now = new Date().toISOString();
  const insertUser = (id: string, role: string, status = 'activo') =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, ?)`,
      )
      .run(id, `${id}@demo.test`, now, role, status);
  insertUser(PSY_A, 'psychologist');
  insertUser(PSY_B, 'psychologist');
  insertUser(PROF_A, 'professor');
  insertUser(SUSP_A, 'psychologist', 'suspendido');
  insertUser(PSY_OTHER, 'psychologist');
  insertUser(PSY_ARCH, 'psychologist');

  const insertOrg = (id: string) =>
    db.prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org', ?, ?)`).run(
      id,
      `slug-${randomUUID()}`,
      now,
    );
  insertOrg(ORG);
  insertOrg(OTHER_ORG);

  const insertConsultorio = (id: string, org: string) =>
    db
      .prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`)
      .run(id, org, id, now);
  insertConsultorio(C_A, ORG);
  insertConsultorio(C_B, ORG);
  insertConsultorio(C_OTHER, OTHER_ORG);
  // Consultorio archivado (soft-delete) de ORG.
  db.prepare(
    `INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 1)`,
  ).run(C_ARCH, ORG, C_ARCH, now);

  const insertMember = (user: string, org: string, role: string, consultorio: string | null) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, ?, '{}', ?, ?)`,
      )
      .run(randomUUID(), org, user, role, now, consultorio);
  insertMember(PSY_A, ORG, 'psychologist', C_A);
  insertMember(PSY_B, ORG, 'psychologist', C_B);
  insertMember(PROF_A, ORG, 'professor', C_A);
  insertMember(SUSP_A, ORG, 'psychologist', C_A);
  insertMember(PSY_OTHER, OTHER_ORG, 'psychologist', C_OTHER);
  insertMember(PSY_ARCH, ORG, 'psychologist', C_ARCH);
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

describe('receptionCanScheduleFor (§5, F5b)', () => {
  it('recepción de A puede agendar para un psicólogo de A', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A], PSY_A)).toBe(true);
  });

  it('recepción de A NO puede agendar para un psicólogo de B', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A], PSY_B)).toBe(false);
  });

  it('si la recepción atiende A y B, sí puede agendar para el de B', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A, C_B], PSY_B)).toBe(true);
  });

  it('NO puede agendar para un PROFESOR (no atiende), aunque sea de su consultorio', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A], PROF_A)).toBe(false);
  });

  it('NO puede agendar para un psicólogo SUSPENDIDO', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A], SUSP_A)).toBe(false);
  });

  it('NO puede agendar para un profesional de otra organización', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_A], PSY_OTHER)).toBe(false);
  });

  it('sin consultorios asignados, no puede agendar para nadie', async () => {
    expect(await receptionCanScheduleFor(ORG, [], PSY_A)).toBe(false);
  });

  it('NO puede agendar en un consultorio ARCHIVADO (soft-delete)', async () => {
    expect(await receptionCanScheduleFor(ORG, [C_ARCH], PSY_ARCH)).toBe(false);
  });
});
