import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * REGRESIÓN: archivar un paciente debe REVOCAR los compartidos de lectura
 * (patient_shares). El bug era que `archivePatientAction` archivaba el paciente
 * pero dejaba VIVAS las concesiones de tipo 'share', por lo que un colega seguía
 * teniendo acceso de solo lectura ('share') a un expediente que el dueño ya había
 * sacado de su consulta. El fix añadió `revokeAllSharesOfPatient` dentro de
 * `archivePatientAction`.
 *
 * `archivePatientAction` es una server action ('use server') difícil de invocar en
 * test, así que aquí fijamos el COMPORTAMIENTO en las funciones puras donde vive la
 * lógica de seguridad: `revokeAllSharesOfPatient` (lo que ahora llama la action) +
 * `activeShareForGrantee` + `resolvePatientAccess`. Contra SQLite real, mismo setup
 * que PatientShare.spec.ts.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-share-archive-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolvePatientAccess: typeof import('@/shared/infrastructure/auth/patientAccess')['resolvePatientAccess'];
let createPatientShare: typeof import('@/shared/infrastructure/auth/patientShares')['createPatientShare'];
let revokeAllSharesOfPatient: typeof import('@/shared/infrastructure/auth/patientShares')['revokeAllSharesOfPatient'];
let activeShareForGrantee: typeof import('@/shared/infrastructure/auth/patientShares')['activeShareForGrantee'];
let listActiveSharesOfOwner: typeof import('@/shared/infrastructure/auth/patientShares')['listActiveSharesOfOwner'];

const ORG = `org-${randomUUID()}`;
const OWNER = `owner-${randomUUID()}`;
const GRANTEE = `grantee-${randomUUID()}`;
const GRANTEE2 = `grantee2-${randomUUID()}`; // segundo colega: confirma que se revocan TODAS
const OTHER_OWNER = `other-${randomUUID()}`; // dueño de otro paciente: no debe verse afectado

const P_SHARED = randomUUID(); // paciente del OWNER, compartido y luego "archivado"
const P_OTHER = randomUUID(); // paciente de OTHER_OWNER, compartido con GRANTEE (no se toca)

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolvePatientAccess } = await import('@/shared/infrastructure/auth/patientAccess'));
  ({
    createPatientShare,
    revokeAllSharesOfPatient,
    activeShareForGrantee,
    listActiveSharesOfOwner,
  } = await import('@/shared/infrastructure/auth/patientShares'));

  const db = getDb();
  const now = new Date().toISOString();

  const insertUser = (id: string, role: string, status: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, ?, ?)`,
      )
      .run(id, `${id}@demo.test`, now, role, status);
  insertUser(OWNER, 'psychologist', 'activo');
  insertUser(GRANTEE, 'psychologist', 'activo');
  insertUser(GRANTEE2, 'psychologist', 'activo');
  insertUser(OTHER_OWNER, 'psychologist', 'activo');

  db.prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org', ?, ?)`).run(
    ORG,
    `slug-${randomUUID()}`,
    now,
  );

  const insertMember = (org: string, user: string) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at)
         VALUES (?, ?, ?, 'psychologist', '{}', ?)`,
      )
      .run(randomUUID(), org, user, now);
  insertMember(ORG, OWNER);
  insertMember(ORG, GRANTEE);
  insertMember(ORG, GRANTEE2);
  insertMember(ORG, OTHER_OWNER);

  const insertPatient = (id: string, name: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, ?, '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, name, now, owner, org);
  insertPatient(P_SHARED, 'Paciente Compartido', OWNER, ORG);
  insertPatient(P_OTHER, 'Paciente De Otro', OTHER_OWNER, ORG);
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

describe('archivar revoca los compartidos de lectura (regresión)', () => {
  it('compartido vivo → el colega resuelve modo "share" (estado previo a archivar)', async () => {
    await createPatientShare({
      patientId: P_SHARED,
      ownerUserId: OWNER,
      granteeUserId: GRANTEE,
      organizationId: ORG,
      createdBy: OWNER,
    });
    await createPatientShare({
      patientId: P_SHARED,
      ownerUserId: OWNER,
      granteeUserId: GRANTEE2,
      organizationId: ORG,
      createdBy: OWNER,
    });
    // Un compartido sobre OTRO paciente (de otro dueño) que NO debe verse afectado.
    await createPatientShare({
      patientId: P_OTHER,
      ownerUserId: OTHER_OWNER,
      granteeUserId: GRANTEE,
      organizationId: ORG,
      createdBy: OTHER_OWNER,
    });

    expect(await activeShareForGrantee(P_SHARED, GRANTEE)).not.toBeNull();
    expect((await resolvePatientAccess(GRANTEE, P_SHARED))?.mode).toBe('share');
    expect((await resolvePatientAccess(GRANTEE2, P_SHARED))?.mode).toBe('share');
    expect(await listActiveSharesOfOwner(P_SHARED, OWNER)).toHaveLength(2);
  });

  it('tras revokeAllSharesOfPatient (lo que ahora hace archivePatientAction), NINGÚN colega tiene acceso "share" (queda sin acceso)', async () => {
    await revokeAllSharesOfPatient(P_SHARED, OWNER);

    // activeShareForGrantee ya no devuelve la concesión para ninguno…
    expect(await activeShareForGrantee(P_SHARED, GRANTEE)).toBeNull();
    expect(await activeShareForGrantee(P_SHARED, GRANTEE2)).toBeNull();

    // …y resolvePatientAccess deja a ambos colegas SIN acceso (ni 'share' ni nada).
    expect(await resolvePatientAccess(GRANTEE, P_SHARED)).toBeNull();
    expect(await resolvePatientAccess(GRANTEE2, P_SHARED)).toBeNull();

    // No quedan concesiones vivas de este paciente para su dueño.
    expect(await listActiveSharesOfOwner(P_SHARED, OWNER)).toHaveLength(0);
  });

  it('solo revoca los compartidos DE ESTE paciente: el compartido sobre otro paciente sigue vivo', async () => {
    // El colega aún tiene acceso 'share' al paciente del OTRO dueño (no fue archivado).
    expect(await activeShareForGrantee(P_OTHER, GRANTEE)).not.toBeNull();
    expect((await resolvePatientAccess(GRANTEE, P_OTHER))?.mode).toBe('share');
  });
});
