import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Aislamiento de CONSULTORIOS en la SUPERVISIÓN (docs/consultorios-spec.md §3, Fase 4).
 *
 * La supervisión es acceso CROSS-OWNER por una vía que NO pasa por resolvePatientAccess
 * (rutas /supervision, co-firma, certificados). Aunque exista un vínculo de supervisión,
 * si el supervisor y el supervisado están en consultorios DISTINTOS de la misma org, el
 * vínculo no debe conceder nada: ni ver el caso, ni co-firmar, ni heredar la cartera.
 * El org_master (sin consultorio) y una org sin consultorios (todo NULL) no se aíslan.
 * Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-cons-sup-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteSupervisorReader: typeof import('@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader')['SqliteSupervisorReader'];
let SqliteSupervisionAccessReader: typeof import('@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader')['SqliteSupervisionAccessReader'];
let SqliteMySupervisorsReader: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqliteMySupervisorsReader')['SqliteMySupervisorsReader'];
let CreateSupervisionLink: typeof import('@/contexts/identity/application/create-supervision-link/CreateSupervisionLink')['CreateSupervisionLink'];
let CreateSupervisionLinkMessage: typeof import('@/contexts/identity/application/create-supervision-link/CreateSupervisionLinkMessage')['CreateSupervisionLinkMessage'];
let ConsultorioMismatchError: typeof import('@/contexts/identity/application/create-supervision-link/ConsultorioMismatchError')['ConsultorioMismatchError'];
let SqliteOrganizationMembershipRepository: typeof import('@/contexts/identity/infrastructure/persistence/SqliteOrganizationMembershipRepository')['SqliteOrganizationMembershipRepository'];
let SqliteSupervisionLinkRepository: typeof import('@/contexts/identity/infrastructure/persistence/SqliteSupervisionLinkRepository')['SqliteSupervisionLinkRepository'];

const ORG = `org-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;

const MASTER = `master-${randomUUID()}`; // sin consultorio → ve/hereda todo
const SUP_A = `supA-${randomUUID()}`; // profesor, consultorio A
const STU_A = `stuA-${randomUUID()}`; // alumno, consultorio A (supervisado legítimo)
const STU_B = `stuB-${randomUUID()}`; // alumno, consultorio B (vínculo cross → aislado)
const STU_C = `stuC-${randomUUID()}`; // alumno, consultorio B, SOLO con vínculo cross de SUP_A

const PAT_A = randomUUID(); // paciente de STU_A
const PAT_B = randomUUID(); // paciente de STU_B
const NOTE_A = randomUUID(); // nota de PAT_A
const NOTE_B = randomUUID(); // nota de PAT_B

const SCOPE = '{"notas":true,"historias":true,"pagos":false}';

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { encryptField } = await import('@/shared/infrastructure/crypto/FieldEncryption');
  ({ SqliteSupervisorReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader'
  ));
  ({ SqliteSupervisionAccessReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader'
  ));
  ({ SqliteMySupervisorsReader } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqliteMySupervisorsReader'
  ));
  ({ CreateSupervisionLink } = await import(
    '@/contexts/identity/application/create-supervision-link/CreateSupervisionLink'
  ));
  ({ CreateSupervisionLinkMessage } = await import(
    '@/contexts/identity/application/create-supervision-link/CreateSupervisionLinkMessage'
  ));
  ({ ConsultorioMismatchError } = await import(
    '@/contexts/identity/application/create-supervision-link/ConsultorioMismatchError'
  ));
  ({ SqliteOrganizationMembershipRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteOrganizationMembershipRepository'
  ));
  ({ SqliteSupervisionLinkRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionLinkRepository'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  const insertUser = (id: string, role: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, 'activo')`,
      )
      .run(id, `${id}@demo.test`, now, role);
  insertUser(MASTER, 'org_master');
  insertUser(SUP_A, 'professor');
  insertUser(STU_A, 'psychologist');
  insertUser(STU_B, 'psychologist');
  insertUser(STU_C, 'psychologist');

  db.prepare(
    `INSERT INTO organizations (id, name, slug, kind, created_at) VALUES (?, 'Uni', ?, 'universidad', ?)`,
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
  insertMember(SUP_A, 'professor', C_A);
  insertMember(STU_A, 'psychologist', C_A);
  insertMember(STU_B, 'psychologist', C_B);
  insertMember(STU_C, 'psychologist', C_B);

  // Vínculos. Algunos cross-consultorio a propósito (mal asignados / heredados): el
  // enforcement debe ignorarlos. created_at escalonado para fijar el ORDER BY.
  const insertLink = (supervisor: string, supervised: string, createdAt: string) =>
    db
      .prepare(
        `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), ORG, supervisor, supervised, SCOPE, createdAt);
  insertLink(SUP_A, STU_A, '2026-01-01T00:00:00.000Z'); // mismo consultorio (legítimo)
  insertLink(SUP_A, STU_B, '2026-01-02T00:00:00.000Z'); // cross → aislado
  insertLink(MASTER, STU_B, '2026-01-03T00:00:00.000Z'); // master (null) → pasa
  insertLink(SUP_A, STU_C, '2026-01-04T00:00:00.000Z'); // único supervisor de STU_C, cross

  const insertPatient = (id: string, owner: string) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, 'Paciente', '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, now, owner, ORG);
  insertPatient(PAT_A, STU_A);
  insertPatient(PAT_B, STU_B);

  const insertNote = (id: string, patient: string, owner: string) =>
    db
      .prepare(
        `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
         VALUES (?, ?, 'Sesión', ?, ?, ?, ?)`,
      )
      .run(id, patient, encryptField('Contenido clínico.'), now, now, owner);
  insertNote(NOTE_A, PAT_A, STU_A);
  insertNote(NOTE_B, PAT_B, STU_B);
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

describe('Consultorios · supervises / supervisesActive (§3, F4)', () => {
  it('mismo consultorio (A): supervises y supervisesActive = true', async () => {
    const reader = new SqliteSupervisorReader();
    expect(await reader.supervises(SUP_A, STU_A, ORG)).toBe(true);
    expect(await reader.supervisesActive(SUP_A, STU_A, ORG)).toBe(true);
  });

  it('OTRO consultorio (A→B): false aunque el vínculo exista (co-firma cerrada)', async () => {
    const reader = new SqliteSupervisorReader();
    expect(await reader.supervises(SUP_A, STU_B, ORG)).toBe(false);
    expect(await reader.supervisesActive(SUP_A, STU_B, ORG)).toBe(false);
  });

  it('el aislamiento aplica incluso SIN pasar organizationId (usa la org del vínculo)', async () => {
    const reader = new SqliteSupervisorReader();
    expect(await reader.supervisesActive(SUP_A, STU_A)).toBe(true);
    expect(await reader.supervisesActive(SUP_A, STU_B)).toBe(false);
  });

  it('el master (sin consultorio) supervisa a cualquier consultorio', async () => {
    expect(await new SqliteSupervisorReader().supervisesActive(MASTER, STU_B, ORG)).toBe(true);
  });
});

describe('Consultorios · findActiveSupervisor (herencia de cartera, §3.2)', () => {
  it('mismo consultorio: hereda al supervisor correcto', async () => {
    expect(await new SqliteSupervisorReader().findActiveSupervisor(STU_A, ORG)).toBe(SUP_A);
  });

  it('cross-consultorio: NO hereda a un supervisor de otro consultorio (cae a custodia)', async () => {
    // STU_C solo tiene a SUP_A (cross) → ningún supervisor del MISMO consultorio → null.
    expect(await new SqliteSupervisorReader().findActiveSupervisor(STU_C, ORG)).toBeNull();
  });

  it('si hay supervisor cross (SUP_A) y uno sin consultorio (MASTER), gana el válido (MASTER)', async () => {
    expect(await new SqliteSupervisorReader().findActiveSupervisor(STU_B, ORG)).toBe(MASTER);
  });
});

describe('Consultorios · SqliteSupervisionAccessReader (ver el caso)', () => {
  it('loadCase del mismo consultorio devuelve el caso', async () => {
    expect(await new SqliteSupervisionAccessReader().loadCase(SUP_A, STU_A, PAT_A)).not.toBeNull();
  });

  it('loadCase cross-consultorio devuelve null', async () => {
    expect(await new SqliteSupervisionAccessReader().loadCase(SUP_A, STU_B, PAT_B)).toBeNull();
  });

  it('findReviewableNote: nota del mismo consultorio sí, cross no', async () => {
    const reader = new SqliteSupervisionAccessReader();
    expect(await reader.findReviewableNote(NOTE_A, SUP_A)).not.toBeNull();
    expect(await reader.findReviewableNote(NOTE_B, SUP_A)).toBeNull();
  });
});

describe('Consultorios · SqliteMySupervisorsReader (a quién pido co-firma)', () => {
  it('al alumno de B NO le ofrece un supervisor de A, pero sí al master', async () => {
    const ids = (await new SqliteMySupervisorsReader().list(STU_B)).map((s) => s.supervisorUserId);
    expect(ids).toContain(MASTER);
    expect(ids).not.toContain(SUP_A);
  });

  it('al alumno de A sí le ofrece su supervisor de A', async () => {
    const ids = (await new SqliteMySupervisorsReader().list(STU_A)).map((s) => s.supervisorUserId);
    expect(ids).toContain(SUP_A);
  });
});

describe('Consultorios · CreateSupervisionLink (write-path: no crear vínculos muertos)', () => {
  it('el maestro NO puede vincular supervisor de A con supervisado de B', async () => {
    const useCase = new CreateSupervisionLink(
      new SqliteOrganizationMembershipRepository(),
      new SqliteSupervisionLinkRepository(),
    );
    await expect(
      useCase.create(
        new CreateSupervisionLinkMessage({
          organizationId: ORG,
          actorUserId: MASTER,
          supervisorUserId: SUP_A,
          supervisedUserId: STU_B,
          scope: { notas: true, historias: true, pagos: false },
        }),
      ),
    ).rejects.toThrow(ConsultorioMismatchError);
  });

  it('el maestro SÍ puede vincular dentro del mismo consultorio (A↔A)', async () => {
    const useCase = new CreateSupervisionLink(
      new SqliteOrganizationMembershipRepository(),
      new SqliteSupervisionLinkRepository(),
    );
    await expect(
      useCase.create(
        new CreateSupervisionLinkMessage({
          organizationId: ORG,
          actorUserId: MASTER,
          supervisorUserId: SUP_A,
          supervisedUserId: STU_A,
          scope: { notas: true, historias: true, pagos: false },
        }),
      ),
    ).resolves.toBeDefined();
  });
});
