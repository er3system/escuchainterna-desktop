import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Custodia institucional (§3.3): cuando un miembro se da de baja sin supervisor
 * activo, su cartera queda RETENIDA por la institución (org_master) con una asignación
 * viva SIN tratante. Leer ese expediente es una ruptura de cristal que debe quedar
 * trazada, y el asistente de IA NUNCA debe surtir esos pacientes. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-custody-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let getDatabaseAdapter: typeof import('@/shared/infrastructure/persistence/SqliteAdapter')['getDatabaseAdapter'];
let isInstitutionalCustody: typeof import('@/shared/infrastructure/auth/institutionalCustody')['isInstitutionalCustody'];

/** Gate permisivo: este test verifica la exclusión por CUSTODIA, no el consentimiento-IA. */
const consintiente = { isAuthorized: async () => true };
let resolvePatientAccess: typeof import('@/shared/infrastructure/auth/patientAccess')['resolvePatientAccess'];
let SqlitePatientContextRetriever: typeof import('@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever')['SqlitePatientContextRetriever'];

const ORG = `org-${randomUUID()}`;
const CUSTODIAN = `custodio-${randomUUID()}`; // org_master que retiene la cartera
const TRATANTE = `tratante-${randomUUID()}`;
const OUTSIDER = `ajeno-${randomUUID()}`;

const P_CUSTODY = randomUUID(); // institucional, retenido (asignación viva tratante NULL)
const P_ACTIVE = randomUUID(); // institucional, con tratante = CUSTODIAN (su propio paciente)
const P_PERSONAL = randomUUID(); // particular (sin organización, sin asignación)

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ getDatabaseAdapter } = await import('@/shared/infrastructure/persistence/SqliteAdapter'));
  ({ isInstitutionalCustody } = await import('@/shared/infrastructure/auth/institutionalCustody'));
  ({ resolvePatientAccess } = await import('@/shared/infrastructure/auth/patientAccess'));
  ({ SqlitePatientContextRetriever } = await import(
    '@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  // La asignación referencia organizations(id) (FK); sembramos la organización.
  db.prepare(
    `INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org Demo', ?, ?)`,
  ).run(ORG, `org-${randomUUID()}`, now);

  const insertPatient = (id: string, name: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, ?, '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, name, now, owner, org);

  // El dominio fija status='institucion' cuando no hay tratante (retenido) y 'activa'
  // cuando sí lo hay. Reproducimos ese invariante para que el test sea fiel.
  const insertAssignment = (patientId: string, tratante: string | null) =>
    db
      .prepare(
        `INSERT INTO patient_assignments (id, patient_id, organization_id, tratante_user_id, supervisor_user_id, status, assigned_by, reason, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'offboarding', ?)`,
      )
      .run(randomUUID(), patientId, ORG, tratante, tratante ? 'activa' : 'institucion', CUSTODIAN, now);

  // Retenido por la institución: dueño = custodio, asignación viva SIN tratante.
  insertPatient(P_CUSTODY, 'Paciente Retenido', CUSTODIAN, ORG);
  insertAssignment(P_CUSTODY, null);

  // Paciente institucional propio del custodio: asignación viva con tratante = custodio.
  insertPatient(P_ACTIVE, 'Paciente Activo', CUSTODIAN, ORG);
  insertAssignment(P_ACTIVE, CUSTODIAN);

  // Paciente particular del tratante: sin organización ni asignación.
  insertPatient(P_PERSONAL, 'Paciente Particular', TRATANTE, null);

  // Una nota para el paciente activo (para comprobar que retrieve sí lo devuelve).
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Sesión 1', 'contenido', ?, ?, ?)`,
  ).run(randomUUID(), P_ACTIVE, now, now, CUSTODIAN);
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

describe('isInstitutionalCustody', () => {
  it('es VERDADERO para el custodio de un paciente retenido (asignación sin tratante)', async () => {
    expect(await isInstitutionalCustody(P_CUSTODY, CUSTODIAN)).toBe(true);
  });

  it('es FALSO para un paciente institucional con tratante (aunque lo posea el mismo usuario)', async () => {
    expect(await isInstitutionalCustody(P_ACTIVE, CUSTODIAN)).toBe(false);
  });

  it('es FALSO para un paciente particular (sin organización ni asignación)', async () => {
    expect(await isInstitutionalCustody(P_PERSONAL, TRATANTE)).toBe(false);
  });

  it('es FALSO si quien pregunta no es el dueño/custodio', async () => {
    expect(await isInstitutionalCustody(P_CUSTODY, OUTSIDER)).toBe(false);
    expect(await isInstitutionalCustody(P_CUSTODY, TRATANTE)).toBe(false);
  });
});

function countAccess(actor: string, patientId: string, action: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM record_access_log WHERE actor_user_id = ? AND patient_id = ? AND action = ?`,
    )
    .get(actor, patientId, action) as { n: number };
  return row.n;
}

describe('resolvePatientAccess — custodia institucional', () => {
  it('el custodio obtiene modo "custody" y deja traza obligatoria acceso_cobertura', async () => {
    const before = countAccess(CUSTODIAN, P_CUSTODY, 'acceso_cobertura');
    const access = await resolvePatientAccess(CUSTODIAN, P_CUSTODY);
    expect(access).not.toBeNull();
    expect(access?.mode).toBe('custody');
    expect(access?.ownerUserId).toBe(CUSTODIAN);
    // La lectura de custodia SIEMPRE se traza (break-glass), nunca en silencio.
    expect(countAccess(CUSTODIAN, P_CUSTODY, 'acceso_cobertura')).toBe(before + 1);
  });

  it('el dueño-tratante de su propio paciente obtiene modo "owner" SIN traza de cobertura', async () => {
    const access = await resolvePatientAccess(CUSTODIAN, P_ACTIVE);
    expect(access?.mode).toBe('owner');
    expect(countAccess(CUSTODIAN, P_ACTIVE, 'acceso_cobertura')).toBe(0);
  });
});

describe('SqlitePatientContextRetriever — excluye pacientes en custodia', () => {
  it('listPatients NO incluye al paciente retenido, sí al activo', async () => {
    const list = await new SqlitePatientContextRetriever(CUSTODIAN).listPatients();
    const ids = list.map((p) => p.id);
    expect(ids).toContain(P_ACTIVE);
    expect(ids).not.toContain(P_CUSTODY);
  });

  it('retrieve devuelve null para el paciente en custodia', async () => {
    expect(await new SqlitePatientContextRetriever(CUSTODIAN).retrieve(P_CUSTODY)).toBeNull();
  });

  it('retrieve sí devuelve el contexto del paciente activo', async () => {
    const ctx = await new SqlitePatientContextRetriever(CUSTODIAN, getDatabaseAdapter(), consintiente).retrieve(P_ACTIVE);
    expect(ctx).not.toBeNull();
    expect(ctx?.patient.id).toBe(P_ACTIVE);
  });
});
