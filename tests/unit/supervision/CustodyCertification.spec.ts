import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Edge co-firma B: el docente certifica un paciente RETENIDO por la institución. El gate
 * (supervisionData) solo deja certificar al docente que consta como SUPERVISOR en la
 * HISTORIA de asignaciones del expediente, y solo para pacientes retenidos
 * (status='institucion') de su organización. Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-custody-cert-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let listHeldPatientsISupervised: typeof import('@/app/supervision/supervisionData')['listHeldPatientsISupervised'];
let requireHeldPatientForCertification: typeof import('@/app/supervision/supervisionData')['requireHeldPatientForCertification'];

const ORG = `org-${randomUUID()}`;
const CUSTODIAN = `custodio-${randomUUID()}`;
const DOCENTE = `docente-${randomUUID()}`;
const STUDENT = `estudiante-${randomUUID()}`;
const OTHER_PROF = `otro-prof-${randomUUID()}`;

// Consultorios (F4): DOCENTE y STUDENT en A; DOCENTE_MOVED se movió a B; DOCENTE_NULL sin consultorio.
const C_A = `consA-${randomUUID()}`;
const C_B = `consB-${randomUUID()}`;
const DOCENTE_MOVED = `docente-mov-${randomUUID()}`; // supervisó a STUDENT (A) pero hoy está en B
const DOCENTE_NULL = `docente-null-${randomUUID()}`; // sin consultorio (master/retrocompat)

const P_HELD = randomUUID(); // retenido + DOCENTE fue supervisor en la historia
const P_HELD_NOSUP = randomUUID(); // retenido pero sin supervisor en la historia
const P_ACTIVE_SUP = randomUUID(); // institucional CON tratante (no retenido), supervisado por DOCENTE
const P_HELD_CROSS = randomUUID(); // retenido; supervisado por DOCENTE_MOVED (hoy en otro consultorio)
const P_HELD_NULL = randomUUID(); // retenido; supervisado por DOCENTE_NULL (sin consultorio)

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ listHeldPatientsISupervised, requireHeldPatientForCertification } = await import(
    '@/app/supervision/supervisionData'
  ));

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org', ?, ?)`).run(
    ORG,
    `org-${randomUUID()}`,
    now,
  );

  const insertPatient = (id: string, name: string) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, ?, '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, name, now, CUSTODIAN, ORG);

  const insertAssignment = (
    patientId: string,
    tratante: string | null,
    supervisor: string | null,
    status: string,
  ) =>
    db
      .prepare(
        `INSERT INTO patient_assignments (id, patient_id, organization_id, tratante_user_id, supervisor_user_id, status, assigned_by, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'offboarding', ?)`,
      )
      .run(randomUUID(), patientId, ORG, tratante, supervisor, status, CUSTODIAN, now);

  // Retenido + el DOCENTE fue su supervisor (fila histórica reasignada) → live institucion.
  insertPatient(P_HELD, 'Paciente Retenido');
  insertAssignment(P_HELD, STUDENT, DOCENTE, 'reasignada');
  insertAssignment(P_HELD, null, null, 'institucion');

  // Retenido pero sin supervisor en la historia.
  insertPatient(P_HELD_NOSUP, 'Retenido Sin Supervisor');
  insertAssignment(P_HELD_NOSUP, null, null, 'institucion');

  // Institucional CON tratante (NO retenido), supervisado por DOCENTE.
  insertPatient(P_ACTIVE_SUP, 'Activo Supervisado');
  insertAssignment(P_ACTIVE_SUP, STUDENT, DOCENTE, 'activa');

  // ===== Aislamiento de consultorio en la custodia (F4) =====
  // organization_memberships.user_id referencia users(id) (FK activa): se insertan los
  // usuarios con membresía. DOCENTE_NULL queda sin membresía → no necesita fila.
  const insertUser = (id: string) =>
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, role, status) VALUES (?, ?, 'x', ?, 'psychologist', 'activo')`,
      )
      .run(id, `${id}@demo.test`, now);
  insertUser(DOCENTE);
  insertUser(STUDENT);
  insertUser(DOCENTE_MOVED);
  db.prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`)
    .run(C_A, ORG, 'A', now);
  db.prepare(`INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`)
    .run(C_B, ORG, 'B', now);
  const insertMember = (user: string, consultorio: string | null) =>
    db
      .prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at, consultorio_id)
         VALUES (?, ?, ?, 'psychologist', '{}', ?, ?)`,
      )
      .run(randomUUID(), ORG, user, now, consultorio);
  insertMember(DOCENTE, C_A); // mismo consultorio que el tratante STUDENT
  insertMember(STUDENT, C_A);
  insertMember(DOCENTE_MOVED, C_B); // se movió a otro consultorio
  // DOCENTE_NULL queda SIN membresía (consultorio NULL = master/retrocompat → pasa).

  // Retenido cuyo supervisor histórico (DOCENTE_MOVED) hoy está en OTRO consultorio que el
  // tratante (STUDENT, A): debe quedar AISLADO (fuga cerrada en F4).
  insertPatient(P_HELD_CROSS, 'Retenido Cross-Consultorio');
  insertAssignment(P_HELD_CROSS, STUDENT, DOCENTE_MOVED, 'reasignada');
  insertAssignment(P_HELD_CROSS, null, null, 'institucion');

  // Retenido cuyo supervisor histórico no tiene consultorio (NULL) → pasa (retrocompat).
  insertPatient(P_HELD_NULL, 'Retenido Supervisor Sin Consultorio');
  insertAssignment(P_HELD_NULL, STUDENT, DOCENTE_NULL, 'reasignada');
  insertAssignment(P_HELD_NULL, null, null, 'institucion');
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

describe('listHeldPatientsISupervised', () => {
  it('el DOCENTE ve el paciente retenido que supervisó', async () => {
    const ids = (await listHeldPatientsISupervised(DOCENTE, ORG)).map((p) => p.patientId);
    expect(ids).toContain(P_HELD);
  });

  it('NO incluye el retenido sin supervisor en la historia', async () => {
    const ids = (await listHeldPatientsISupervised(DOCENTE, ORG)).map((p) => p.patientId);
    expect(ids).not.toContain(P_HELD_NOSUP);
  });

  it('NO incluye el institucional CON tratante (no retenido) aunque el docente lo supervise', async () => {
    const ids = (await listHeldPatientsISupervised(DOCENTE, ORG)).map((p) => p.patientId);
    expect(ids).not.toContain(P_ACTIVE_SUP);
  });

  it('otro profesor que NO supervisó el caso no ve nada', async () => {
    expect(await listHeldPatientsISupervised(OTHER_PROF, ORG)).toHaveLength(0);
  });
});

describe('requireHeldPatientForCertification', () => {
  it('devuelve el nombre para el docente supervisor histórico', async () => {
    const result = await requireHeldPatientForCertification(DOCENTE, ORG, P_HELD);
    expect(result.patientId).toBe(P_HELD);
    expect(result.patientName).toBe('Paciente Retenido');
  });

  it('404 (throws) para un profesor que no supervisó el caso', async () => {
    await expect(requireHeldPatientForCertification(OTHER_PROF, ORG, P_HELD)).rejects.toThrow();
  });

  it('404 (throws) para un paciente que no está retenido', async () => {
    await expect(requireHeldPatientForCertification(DOCENTE, ORG, P_ACTIVE_SUP)).rejects.toThrow();
  });
});

describe('Consultorios · aislamiento de la custodia (F4)', () => {
  it('el docente que supervisó pero HOY está en OTRO consultorio NO ve el retenido', async () => {
    const ids = (await listHeldPatientsISupervised(DOCENTE_MOVED, ORG)).map((p) => p.patientId);
    expect(ids).not.toContain(P_HELD_CROSS);
  });

  it('...y NO puede certificarlo (404/throws)', async () => {
    await expect(requireHeldPatientForCertification(DOCENTE_MOVED, ORG, P_HELD_CROSS)).rejects.toThrow();
  });

  it('el docente del MISMO consultorio que el tratante histórico SÍ ve y certifica', async () => {
    // DOCENTE y STUDENT en C_A → custodia permitida (caso legítimo).
    expect((await listHeldPatientsISupervised(DOCENTE, ORG)).map((p) => p.patientId)).toContain(P_HELD);
    expect((await requireHeldPatientForCertification(DOCENTE, ORG, P_HELD)).patientId).toBe(P_HELD);
  });

  it('un supervisor histórico SIN consultorio (master/retrocompat) sigue viendo el retenido', async () => {
    const ids = (await listHeldPatientsISupervised(DOCENTE_NULL, ORG)).map((p) => p.patientId);
    expect(ids).toContain(P_HELD_NULL);
  });
});
