import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Transferir un paciente PARTICULAR a un colega (Ajustes › Transferir): cambia el dueño
 * Y cascadea TODO su expediente para que el colega tenga continuidad completa. Debe:
 * mover la ficha + el contenido del dueño anterior, dejar la propiedad como particular
 * (org NULL), no mover lo que no sea del dueño anterior, y NO operar sobre institucionales.
 * Contra SQLite real.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-transfer-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqlitePatientOwnerWriter: typeof import('@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter')['SqlitePatientOwnerWriter'];
let SqlitePatientDirectory: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory')['SqlitePatientDirectory'];

const ORG = `org-${randomUUID()}`;
const OWNER = `owner-${randomUUID()}`;
const GRANTEE = `grantee-${randomUUID()}`;
const OTHER = `other-${randomUUID()}`;

const P = randomUUID(); // particular del OWNER
const P_INST = randomUUID(); // institucional (no debe transferirse por esta vía)
const NOTE = randomUUID();
const FILE = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePatientOwnerWriter } = await import(
    '@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter'
  ));
  ({ SqlitePatientDirectory } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Org', ?, ?)`).run(
    ORG,
    `slug-${randomUUID()}`,
    now,
  );

  const insertPatient = (id: string, owner: string, org: string | null) =>
    db
      .prepare(
        `INSERT INTO patients (id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json, archived, created_at, owner_user_id, organization_id)
         VALUES (?, 'Paciente', '', NULL, '', NULL, '[]', 0, ?, ?, ?)`,
      )
      .run(id, now, owner, org);
  insertPatient(P, OWNER, null);
  insertPatient(P_INST, OWNER, ORG);

  // Contenido clínico/operativo del OWNER que DEBE viajar con el paciente.
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Sesión 1', 'contenido', ?, ?, ?)`,
  ).run(NOTE, P, now, now, OWNER);
  db.prepare(
    `INSERT INTO patient_files (id, patient_id, filename, stored_path, mime, size, uploaded_at, owner_user_id)
     VALUES (?, ?, 'informe.pdf', 'x/fake.pdf', 'application/pdf', 10, ?, ?)`,
  ).run(FILE, P, now, OWNER);
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

function ownerOf(table: string, id: string): string | undefined {
  return (
    getDb().prepare(`SELECT owner_user_id FROM ${table} WHERE id = ?`).get(id) as
      | { owner_user_id: string }
      | undefined
  )?.owner_user_id;
}

describe('SqlitePatientOwnerWriter.transferIndividual', () => {
  it('mueve la ficha y cascadea TODO el contenido del dueño anterior al colega', async () => {
    const ok = await new SqlitePatientOwnerWriter().transferIndividual(P, OWNER, GRANTEE);
    expect(ok).toBe(true);

    // La ficha cambió de dueño pero sigue siendo PARTICULAR (org NULL).
    const row = getDb()
      .prepare('SELECT owner_user_id, organization_id FROM patients WHERE id = ?')
      .get(P) as { owner_user_id: string; organization_id: string | null };
    expect(row.owner_user_id).toBe(GRANTEE);
    expect(row.organization_id).toBeNull();

    // El contenido clínico/operativo viajó con él.
    expect(ownerOf('session_notes', NOTE)).toBe(GRANTEE);
    expect(ownerOf('patient_files', FILE)).toBe(GRANTEE);

    // El dueño anterior ya no lo ve en su alcance.
    expect(await new SqlitePatientDirectory(OWNER).findSummary(P)).toBeNull();
    // El colega sí.
    expect(await new SqlitePatientDirectory(GRANTEE).findSummary(P)).not.toBeNull();
  });

  it('NO opera sobre un paciente institucional (devuelve false, sin tocar nada)', async () => {
    const ok = await new SqlitePatientOwnerWriter().transferIndividual(P_INST, OWNER, GRANTEE);
    expect(ok).toBe(false);
    const owner = (
      getDb().prepare('SELECT owner_user_id FROM patients WHERE id = ?').get(P_INST) as {
        owner_user_id: string;
      }
    ).owner_user_id;
    expect(owner).toBe(OWNER); // intacto
  });

  it('NO transfiere si quien lo pide no es el dueño actual (devuelve false)', async () => {
    // P ya es de GRANTEE; OTHER no es su dueño.
    const ok = await new SqlitePatientOwnerWriter().transferIndividual(P, OTHER, OTHER);
    expect(ok).toBe(false);
    const owner = (
      getDb().prepare('SELECT owner_user_id FROM patients WHERE id = ?').get(P) as {
        owner_user_id: string;
      }
    ).owner_user_id;
    expect(owner).toBe(GRANTEE); // sigue siendo del colega, no se movió
  });
});
