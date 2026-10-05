import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Compartir un expediente en SOLO LECTURA con un colega de la MISMA organización
 * (Ajustes › Compartir, migración v24). El resolutor único concede modo 'share' solo
 * mientras TODO siga válido: concesión viva, quien comparte SIGUE siendo dueño y ambos
 * siguen activos en la misma org. Cualquier desviación falla cerrado. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-share-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let resolvePatientAccess: typeof import('@/shared/infrastructure/auth/patientAccess')['resolvePatientAccess'];
let createPatientShare: typeof import('@/shared/infrastructure/auth/patientShares')['createPatientShare'];
let revokePatientShare: typeof import('@/shared/infrastructure/auth/patientShares')['revokePatientShare'];
let listActiveSharesOfOwner: typeof import('@/shared/infrastructure/auth/patientShares')['listActiveSharesOfOwner'];
let listPatientsSharedWithMe: typeof import('@/shared/infrastructure/auth/patientShares')['listPatientsSharedWithMe'];
let SqlitePatientDirectory: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory')['SqlitePatientDirectory'];
let SqlitePatientFileRepository: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository')['SqlitePatientFileRepository'];

const ORG = `org-${randomUUID()}`;
const ORG2 = `org2-${randomUUID()}`;
const OWNER = `owner-${randomUUID()}`;
const GRANTEE = `grantee-${randomUUID()}`;
const OUTSIDER = `outsider-${randomUUID()}`; // miembro de OTRA organización
const SUSPENDED = `susp-${randomUUID()}`; // miembro de ORG pero suspendido
const ASSISTANT = `assist-${randomUUID()}`; // rol assistant

const P_INDIV = randomUUID(); // particular (org NULL) del OWNER — el caso universal
const P_INST = randomUUID(); // institucional (org=ORG) del OWNER
const P_STALE = randomUUID(); // se le cambia el dueño para simular una transferencia
const FILE_OF_OWNER = randomUUID(); // archivo clínico propiedad del OWNER

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ resolvePatientAccess } = await import('@/shared/infrastructure/auth/patientAccess'));
  ({ createPatientShare, revokePatientShare, listActiveSharesOfOwner, listPatientsSharedWithMe } =
    await import('@/shared/infrastructure/auth/patientShares'));
  ({ SqlitePatientDirectory } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory'
  ));
  ({ SqlitePatientFileRepository } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository'
  ));

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
  insertUser(OUTSIDER, 'psychologist', 'activo');
  insertUser(SUSPENDED, 'psychologist', 'suspendido');
  insertUser(ASSISTANT, 'assistant', 'activo');

  const insertOrg = (id: string) =>
    db
      .prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org', ?, ?)`)
      .run(id, `slug-${randomUUID()}`, now);
  insertOrg(ORG);
  insertOrg(ORG2);

  const insertMember = (org: string, user: string) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at)
         VALUES (?, ?, ?, 'psychologist', '{}', ?)`,
      )
      .run(randomUUID(), org, user, now);
  insertMember(ORG, OWNER);
  insertMember(ORG, GRANTEE);
  insertMember(ORG, SUSPENDED);
  insertMember(ORG2, OUTSIDER);

  const insertPatient = (id: string, name: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, ?, '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, name, now, owner, org);
  insertPatient(P_INDIV, 'Paciente Particular', OWNER, null);
  insertPatient(P_INST, 'Paciente Institucional', OWNER, ORG);
  insertPatient(P_STALE, 'Paciente Transferido', OWNER, ORG);

  // Un archivo clínico del OWNER (para probar que un grantee no lo alcanza por las
  // superficies que NO pasan por resolvePatientAccess, p. ej. la ruta de bytes crudos).
  db.prepare(
    `INSERT INTO patient_files (id, patient_id, filename, stored_path, mime, size, uploaded_at, owner_user_id)
     VALUES (?, ?, 'informe.pdf', 'data/uploads/x/fake.pdf', 'application/pdf', 10, ?, ?)`,
  ).run(FILE_OF_OWNER, P_INST, now, OWNER);
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

function countAccess(actor: string, patientId: string, action: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM record_access_log WHERE actor_user_id = ? AND patient_id = ? AND action = ?`,
    )
    .get(actor, patientId, action) as { n: number };
  return row.n;
}

describe('resolvePatientAccess — compartir en solo lectura', () => {
  it('un colega con concesión viva obtiene modo "share" del dueño, y se traza acceso_compartido (incluso para un paciente PARTICULAR)', async () => {
    await createPatientShare({
      patientId: P_INDIV,
      ownerUserId: OWNER,
      granteeUserId: GRANTEE,
      organizationId: ORG,
      createdBy: OWNER,
    });
    const before = countAccess(GRANTEE, P_INDIV, 'acceso_compartido');
    const access = await resolvePatientAccess(GRANTEE, P_INDIV);
    expect(access).not.toBeNull();
    expect(access?.mode).toBe('share');
    expect(access?.ownerUserId).toBe(OWNER);
    expect(countAccess(GRANTEE, P_INDIV, 'acceso_compartido')).toBe(before + 1);
  });

  it('el dueño sigue viendo su propio paciente como "owner" (compartir no le afecta)', async () => {
    const access = await resolvePatientAccess(OWNER, P_INDIV);
    expect(access?.mode).toBe('owner');
    expect(access?.ownerUserId).toBe(OWNER);
  });

  it('tras REVOCAR, el colega deja de tener acceso (null)', async () => {
    const [grant] = await listActiveSharesOfOwner(P_INDIV, OWNER);
    expect(grant).toBeDefined();
    await revokePatientShare(grant.id, OWNER);
    expect(await resolvePatientAccess(GRANTEE, P_INDIV)).toBeNull();
  });

  it('una concesión hacia alguien de OTRA organización no concede acceso (null)', async () => {
    await createPatientShare({
      patientId: P_INST,
      ownerUserId: OWNER,
      granteeUserId: OUTSIDER,
      organizationId: ORG,
      createdBy: OWNER,
    });
    expect(await resolvePatientAccess(OUTSIDER, P_INST)).toBeNull();
  });

  it('una concesión hacia un miembro SUSPENDIDO no concede acceso (null)', async () => {
    await createPatientShare({
      patientId: P_INST,
      ownerUserId: OWNER,
      granteeUserId: SUSPENDED,
      organizationId: ORG,
      createdBy: OWNER,
    });
    expect(await resolvePatientAccess(SUSPENDED, P_INST)).toBeNull();
  });

  it('un ASISTENTE nunca recibe acceso por un share, aunque exista la fila (null)', async () => {
    await createPatientShare({
      patientId: P_INST,
      ownerUserId: OWNER,
      granteeUserId: ASSISTANT,
      organizationId: ORG,
      createdBy: OWNER,
    });
    expect(await resolvePatientAccess(ASSISTANT, P_INST)).toBeNull();
  });

  it('si quien compartió YA NO es el dueño (transferencia), la concesión muere (null)', async () => {
    await createPatientShare({
      patientId: P_STALE,
      ownerUserId: OWNER,
      granteeUserId: GRANTEE,
      organizationId: ORG,
      createdBy: OWNER,
    });
    // El colega tenía acceso mientras OWNER era el dueño…
    expect((await resolvePatientAccess(GRANTEE, P_STALE))?.mode).toBe('share');
    // …pero al transferir el paciente a otro, OWNER deja de poder leerlo y la concesión cae.
    getDb().prepare('UPDATE patients SET owner_user_id = ? WHERE id = ?').run(OUTSIDER, P_STALE);
    expect(await resolvePatientAccess(GRANTEE, P_STALE)).toBeNull();
  });
});

/**
 * INVARIANTE QUE SOSTIENE EL "solo resumen" (defensa en profundidad, no solo el redirect
 * del layout): las superficies profundas del expediente (export imprimible, ruta de bytes
 * de archivos, notas, diagnósticos, …) se acotan al USUARIO EN SESIÓN, no al dueño del
 * paciente. Por eso un colega con un share —que NO es el dueño— obtiene vacío/404 en su
 * propio alcance aunque alcanzara la página. Si algún día una superficie profunda empieza
 * a resolver acceso y a acotarse por `access.ownerUserId`, NUNCA debe hacerlo para el modo
 * 'share' (ni 'coverage'): solo el resumen es compartible. Este bloque fija esa garantía.
 */
describe('confinamiento del grantee a las superficies acotadas al dueño', () => {
  it('el resolutor SÍ le da el resumen (modo share)…', async () => {
    await createPatientShare({
      patientId: P_INST,
      ownerUserId: OWNER,
      granteeUserId: GRANTEE,
      organizationId: ORG,
      createdBy: OWNER,
    });
    expect((await resolvePatientAccess(GRANTEE, P_INST))?.mode).toBe('share');
  });

  it('…pero en SU PROPIO alcance el paciente no existe (las páginas profundas lo verían vacío)', async () => {
    // Las páginas profundas hacen `new SqlitePatientDirectory(sessionUserId)` (el grantee).
    expect(await new SqlitePatientDirectory(GRANTEE).findSummary(P_INST)).toBeNull();
    // …mientras que el dueño sí lo encuentra (el alcance es lo que confina, no el resolutor).
    expect(await new SqlitePatientDirectory(OWNER).findSummary(P_INST)).not.toBeNull();
  });

  it('la ruta de bytes de archivos (sin red de redirect) niega por alcance: el grantee no encuentra el archivo del dueño', async () => {
    // Reproduce exactamente lo que hace api/pacientes/[id]/archivos/[fileId]/route.ts:
    // new SqlitePatientFileRepository(sessionUserId).findById(fileId) → null para el grantee.
    expect(await new SqlitePatientFileRepository(GRANTEE).findById(FILE_OF_OWNER)).toBeNull();
    expect(await new SqlitePatientFileRepository(OWNER).findById(FILE_OF_OWNER)).not.toBeNull();
  });
});

/**
 * "Compartidos conmigo" (descubrimiento en /pacientes): espeja las verificaciones del
 * resolutor sin loguear. En este punto del archivo, GRANTEE tiene una concesión VIVA
 * sobre P_INST (creada arriba); su concesión sobre P_INDIV fue revocada y la de P_STALE
 * cayó al transferir. OUTSIDER (otra org), SUSPENDED y ASSISTANT no deben ver nada.
 */
describe('listPatientsSharedWithMe', () => {
  it('lista los expedientes con concesión viva hacia mí (con el nombre del dueño), y NADA revocado/transferido', async () => {
    const mine = await listPatientsSharedWithMe(GRANTEE);
    const ids = mine.map((p) => p.id);
    expect(ids).toContain(P_INST);
    expect(ids).not.toContain(P_INDIV); // revocado
    expect(ids).not.toContain(P_STALE); // el dueño cambió → la concesión murió
    expect(mine.find((p) => p.id === P_INST)?.ownerName).toBeTruthy();
  });

  it('no muestra nada a un miembro de otra organización', async () => {
    expect((await listPatientsSharedWithMe(OUTSIDER)).map((p) => p.id)).not.toContain(P_INST);
  });

  it('no muestra nada a un miembro suspendido', async () => {
    expect(await listPatientsSharedWithMe(SUSPENDED)).toHaveLength(0);
  });

  it('no muestra nada a un asistente (no es miembro de la org)', async () => {
    expect(await listPatientsSharedWithMe(ASSISTANT)).toHaveLength(0);
  });
});
