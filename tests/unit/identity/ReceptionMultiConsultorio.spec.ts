import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Recepción multi-consultorio (consultorios-spec §5, Fase 5a). El org_master crea una
 * cuenta de recepción ligada a N consultorios de SU organización; solo el maestro puede;
 * los consultorios deben ser de la org. SetReceptionConsultorios no puede tocar la
 * recepción de otra org. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-reception-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let createIdentityUseCases: typeof import('@/contexts/identity/infrastructure/createIdentityUseCases')['createIdentityUseCases'];
let SqliteReceptionConsultorioRepository: typeof import('@/contexts/identity/infrastructure/persistence/SqliteReceptionConsultorioRepository')['SqliteReceptionConsultorioRepository'];
let NotOrganizationMasterError: typeof import('@/contexts/identity/application/create-organization-member/NotOrganizationMasterError')['NotOrganizationMasterError'];
let isReceptionUser: typeof import('@/shared/infrastructure/auth/dataOwner')['isReceptionUser'];

const ORG = `org-${randomUUID()}`;
const OTHER_ORG = `org2-${randomUUID()}`;
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const C_OTHER = `consX-${randomUUID()}`; // de OTHER_ORG
const MASTER = `master-${randomUUID()}`;
const OTHER_MASTER = `master2-${randomUUID()}`;
const PSY = `psy-${randomUUID()}`; // miembro no-master

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ createIdentityUseCases } = await import(
    '@/contexts/identity/infrastructure/createIdentityUseCases'
  ));
  ({ SqliteReceptionConsultorioRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteReceptionConsultorioRepository'
  ));
  ({ NotOrganizationMasterError } = await import(
    '@/contexts/identity/application/create-organization-member/NotOrganizationMasterError'
  ));
  ({ isReceptionUser } = await import('@/shared/infrastructure/auth/dataOwner'));

  const db = getDb();
  const now = new Date().toISOString();
  const insertUser = (id: string, role: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, 'activo')`,
      )
      .run(id, `${id}@demo.test`, now, role);
  insertUser(MASTER, 'org_master');
  insertUser(OTHER_MASTER, 'org_master');
  insertUser(PSY, 'psychologist');

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

  const insertMember = (user: string, org: string, role: string) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, ?, '{}', ?, NULL)`,
      )
      .run(randomUUID(), org, user, role, now);
  insertMember(MASTER, ORG, 'master');
  insertMember(OTHER_MASTER, OTHER_ORG, 'master');
  insertMember(PSY, ORG, 'psychologist');
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

function createReception(actor: string, org: string, email: string, consultorioIds: string[]) {
  return createIdentityUseCases().createReception.create({
    organizationId: org,
    actorUserId: actor,
    fullName: 'Recepción Demo',
    email,
    consultorioIds,
  });
}

describe('CreateReception (§5)', () => {
  it('el maestro crea una recepción ligada a un consultorio de su org', async () => {
    const created = await createReception(MASTER, ORG, `r1-${randomUUID()}@demo.test`, [C_A]);
    expect(created.userId).toBeTruthy();
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(8);

    const scope = await new SqliteReceptionConsultorioRepository().scopeFor(created.userId);
    expect(scope).not.toBeNull();
    expect(scope?.organizationId).toBe(ORG);
    expect(scope?.consultorioIds).toEqual([C_A]);

    const account = getDb().prepare('SELECT role FROM users WHERE id = ?').get(created.userId) as {
      role: string;
    };
    expect(account.role).toBe('assistant');
  });

  it('un NO-maestro no puede crear recepción', async () => {
    await expect(
      createReception(PSY, ORG, `r2-${randomUUID()}@demo.test`, [C_A]),
    ).rejects.toThrow(NotOrganizationMasterError);
  });

  it('rechaza un consultorio que no es de la organización', async () => {
    await expect(
      createReception(MASTER, ORG, `r3-${randomUUID()}@demo.test`, [C_OTHER]),
    ).rejects.toThrow();
  });

  it('rechaza sin consultorios', async () => {
    await expect(createReception(MASTER, ORG, `r4-${randomUUID()}@demo.test`, [])).rejects.toThrow();
  });
});

describe('SetReceptionConsultorios (§5)', () => {
  it('el maestro cambia el conjunto de consultorios de su recepción', async () => {
    const created = await createReception(MASTER, ORG, `r5-${randomUUID()}@demo.test`, [C_A]);
    await createIdentityUseCases().setReceptionConsultorios.set({
      organizationId: ORG,
      actorUserId: MASTER,
      assistantUserId: created.userId,
      consultorioIds: [C_A, C_B],
    });
    const scope = await new SqliteReceptionConsultorioRepository().scopeFor(created.userId);
    expect(scope?.consultorioIds.sort()).toEqual([C_A, C_B].sort());
  });

  it('el maestro de OTRA org no puede tocar esta recepción', async () => {
    const created = await createReception(MASTER, ORG, `r6-${randomUUID()}@demo.test`, [C_A]);
    await expect(
      createIdentityUseCases().setReceptionConsultorios.set({
        organizationId: OTHER_ORG,
        actorUserId: OTHER_MASTER,
        assistantUserId: created.userId,
        consultorioIds: [C_OTHER],
      }),
    ).rejects.toThrow();
    // El alcance original no cambió.
    expect(
      (await new SqliteReceptionConsultorioRepository().scopeFor(created.userId))?.organizationId,
    ).toBe(ORG);
  });
});

describe('isReceptionUser respeta el flag de la org (fix bucle de ruteo F5b)', () => {
  it('recepción provista pero org SIN habilitar ⇒ NO es recepción activa; al habilitar ⇒ sí', async () => {
    const created = await createReception(MASTER, ORG, `r7-${randomUUID()}@demo.test`, [C_A]);
    // La org de prueba nace con reception_multi_consultorio = 0 (default v44).
    expect(await isReceptionUser(created.userId)).toBe(false);
    getDb().prepare('UPDATE organizations SET reception_multi_consultorio = 1 WHERE id = ?').run(ORG);
    expect(await isReceptionUser(created.userId)).toBe(true);
    getDb().prepare('UPDATE organizations SET reception_multi_consultorio = 0 WHERE id = ?').run(ORG);
    expect(await isReceptionUser(created.userId)).toBe(false);
  });
});
