import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SaveSupervisionReviewMessage } from '@/contexts/identity/application/save-supervision-review/SaveSupervisionReviewMessage';
import { SupervisionLinkRequiredError } from '@/contexts/identity/domain/errors/SupervisionLinkRequiredError';

/**
 * Fix de seguridad (v28): el vínculo de supervisión tiene VIGENCIA. El read path
 * exige revoked_at IS NULL Y supervisado activo. Antes, un vínculo sin estado
 * daba lectura clínica perpetua aunque se revocara o se diera de baja al
 * supervisado. SaveSupervisionReview es la sonda: pasa por findReviewableNote,
 * que es justo una de las queries endurecidas.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-vigencia-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let useCase: import('@/contexts/identity/application/save-supervision-review/SaveSupervisionReview').SaveSupervisionReview;
let repo: import('@/contexts/identity/infrastructure/persistence/SqliteSupervisionLinkRepository').SqliteSupervisionLinkRepository;
let SupervisionLink: typeof import('@/contexts/identity/domain/SupervisionLink')['SupervisionLink'];
let SqliteSupervisorReader: typeof import('@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader')['SqliteSupervisorReader'];

const orgId = `org-${randomUUID()}`;
const profesorId = `profesor-${randomUUID()}`;
const estudianteId = `estudiante-${randomUUID()}`;
const patientId = `paciente-${randomUUID()}`;
const noteId = `nota-${randomUUID()}`;

async function probe(): Promise<void> {
  await useCase.save(
    new SaveSupervisionReviewMessage({
      supervisorUserId: profesorId,
      sessionNoteId: noteId,
      comment: 'Sonda de acceso.',
    }),
  );
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { encryptField } = await import('@/shared/infrastructure/crypto/FieldEncryption');
  const { SaveSupervisionReview } = await import(
    '@/contexts/identity/application/save-supervision-review/SaveSupervisionReview'
  );
  const { SqliteSupervisionReviewRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionReviewRepository'
  );
  const { SqliteSupervisionAccessReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader'
  );
  const { InAppSupervisionReviewNotifier } = await import(
    '@/contexts/identity/infrastructure/notifications/InAppSupervisionReviewNotifier'
  );
  const { SqliteSupervisionLinkRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionLinkRepository'
  );
  ({ SupervisionLink } = await import('@/contexts/identity/domain/SupervisionLink'));
  ({ SqliteSupervisorReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader'
  ));

  useCase = new SaveSupervisionReview(
    new SqliteSupervisionAccessReader(),
    new SqliteSupervisionReviewRepository(),
    new InAppSupervisionReviewNotifier(),
  );
  repo = new SqliteSupervisionLinkRepository();

  const db = getDb();
  const now = new Date().toISOString();
  for (const [id, email, role] of [
    [profesorId, 'profesor-vig@spec.test', 'professor'],
    [estudianteId, 'estudiante-vig@spec.test', 'psychologist'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', ?, 'activo', ?)`,
    ).run(id, email, role, now);
  }
  db.prepare(
    `INSERT INTO organizations (id, name, slug, kind, created_at) VALUES (?, 'Uni Vig', ?, 'universidad', ?)`,
  ).run(orgId, `uni-vig-${randomUUID()}`, now);
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, '{"notas":true,"historias":true,"pagos":false}', ?)`,
  ).run(randomUUID(), orgId, profesorId, estudianteId, now);
  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente Vig', ?, ?)`,
  ).run(patientId, now, estudianteId);
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Sesión', ?, ?, ?, ?)`,
  ).run(noteId, patientId, encryptField('Contenido clínico sensible.'), now, now, estudianteId);
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

describe('Vigencia del vínculo de supervisión (v28)', () => {
  it('con vínculo vigente y supervisado activo, el supervisor accede', async () => {
    await expect(probe()).resolves.toBeUndefined();
  });

  it('al REVOCAR el vínculo, el acceso se corta de inmediato', async () => {
    getDb()
      .prepare(`UPDATE supervision_links SET revoked_at = ? WHERE supervisor_user_id = ? AND supervised_user_id = ?`)
      .run(new Date().toISOString(), profesorId, estudianteId);
    await expect(probe()).rejects.toThrow(SupervisionLinkRequiredError);
  });

  it('re-crear el vínculo lo RE-ACTIVA (save() pone revoked_at = NULL)', async () => {
    await repo.save(
      SupervisionLink.fromPrimitives({
        id: randomUUID(),
        organizationId: orgId,
        supervisorUserId: profesorId,
        supervisedUserId: estudianteId,
        scope: { notas: true, historias: true, pagos: false },
        createdAt: new Date().toISOString(),
      }),
    );
    const row = getDb()
      .prepare(`SELECT revoked_at FROM supervision_links WHERE supervisor_user_id = ? AND supervised_user_id = ?`)
      .get(profesorId, estudianteId) as { revoked_at: string | null };
    expect(row.revoked_at).toBeNull();
    await expect(probe()).resolves.toBeUndefined();
  });

  it('si el SUPERVISADO queda suspendido, el acceso se corta (fail-closed)', async () => {
    getDb().prepare(`UPDATE users SET status = 'suspendido' WHERE id = ?`).run(estudianteId);
    await expect(probe()).rejects.toThrow(SupervisionLinkRequiredError);
    getDb().prepare(`UPDATE users SET status = 'activo' WHERE id = ?`).run(estudianteId); // restaura
  });
});

describe('supervisesActive (gate de co-firma)', () => {
  it('con vínculo vigente y supervisado activo, supervisesActive y supervises = true', async () => {
    const reader = new SqliteSupervisorReader();
    expect(await reader.supervises(profesorId, estudianteId, orgId)).toBe(true);
    expect(await reader.supervisesActive(profesorId, estudianteId, orgId)).toBe(true);
  });

  it('si el supervisado está SUSPENDIDO: supervises sigue true pero supervisesActive = false (cierra la co-firma)', async () => {
    getDb().prepare(`UPDATE users SET status = 'suspendido' WHERE id = ?`).run(estudianteId);
    const reader = new SqliteSupervisorReader();
    // supervises() solo mira revoked_at (suficiente para cobertura), supervisesActive exige cuenta activa.
    expect(await reader.supervises(profesorId, estudianteId, orgId)).toBe(true);
    expect(await reader.supervisesActive(profesorId, estudianteId, orgId)).toBe(false);
    getDb().prepare(`UPDATE users SET status = 'activo' WHERE id = ?`).run(estudianteId);
  });

  it('si el vínculo está revocado, supervisesActive = false', async () => {
    getDb()
      .prepare(`UPDATE supervision_links SET revoked_at = ? WHERE supervisor_user_id = ? AND supervised_user_id = ?`)
      .run(new Date().toISOString(), profesorId, estudianteId);
    expect(await new SqliteSupervisorReader().supervisesActive(profesorId, estudianteId, orgId)).toBe(false);
    getDb()
      .prepare(`UPDATE supervision_links SET revoked_at = NULL WHERE supervisor_user_id = ? AND supervised_user_id = ?`)
      .run(profesorId, estudianteId);
  });
});
