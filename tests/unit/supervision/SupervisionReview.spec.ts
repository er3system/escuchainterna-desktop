import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SaveSupervisionReviewMessage } from '@/contexts/identity/application/save-supervision-review/SaveSupervisionReviewMessage';
import { EmptySupervisionReviewChangeError } from '@/contexts/identity/application/save-supervision-review/EmptySupervisionReviewChangeError';
import { SupervisionLinkRequiredError } from '@/contexts/identity/domain/errors/SupervisionLinkRequiredError';

/**
 * Supervisión académica activa (v3.2): la retroalimentación del supervisor
 * sobre notas del supervisado exige vínculo vigente con alcance de notas,
 * se cifra at-rest y notifica al estudiante por la campana (kind 'supervision').
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-supervision-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let useCase: import('@/contexts/identity/application/save-supervision-review/SaveSupervisionReview').SaveSupervisionReview;
let listReviews: import('@/contexts/identity/application/list-supervision-reviews/ListSupervisionReviews').ListSupervisionReviews;

const orgId = `org-${randomUUID()}`;
const profesorId = `profesor-${randomUUID()}`;
const profesorEmail = 'profesor@spec.test';
const profesorSinVinculoId = `intruso-${randomUUID()}`;
const profesorSinNotasId = `sin-notas-${randomUUID()}`;
const estudianteId = `estudiante-${randomUUID()}`;
const patientId = `paciente-${randomUUID()}`;
const noteId = `nota-${randomUUID()}`;
const otherNoteId = `nota2-${randomUUID()}`;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { encryptField } = await import('@/shared/infrastructure/crypto/FieldEncryption');
  const { SaveSupervisionReview } = await import(
    '@/contexts/identity/application/save-supervision-review/SaveSupervisionReview'
  );
  const { ListSupervisionReviews } = await import(
    '@/contexts/identity/application/list-supervision-reviews/ListSupervisionReviews'
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
  useCase = new SaveSupervisionReview(
    new SqliteSupervisionAccessReader(),
    new SqliteSupervisionReviewRepository(),
    new InAppSupervisionReviewNotifier(),
  );
  listReviews = new ListSupervisionReviews(new SqliteSupervisionReviewRepository());

  const db = getDb();
  const now = new Date().toISOString();
  for (const [id, email, role] of [
    [profesorId, profesorEmail, 'professor'],
    [profesorSinVinculoId, 'intruso@spec.test', 'professor'],
    [profesorSinNotasId, 'sin-notas@spec.test', 'professor'],
    [estudianteId, 'estudiante@spec.test', 'psychologist'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', ?, 'activo', ?)`,
    ).run(id, email, role, now);
  }
  db.prepare(
    `INSERT INTO organizations (id, name, slug, kind, created_at) VALUES (?, 'Uni Spec', ?, 'universidad', ?)`,
  ).run(orgId, `uni-spec-${randomUUID()}`, now);

  // Vínculos: profesor con alcance de notas; profesorSinNotas con notas:false.
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, '{"notas":true,"historias":true,"pagos":false}', ?)`,
  ).run(randomUUID(), orgId, profesorId, estudianteId, now);
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, '{"notas":false,"historias":true,"pagos":false}', ?)`,
  ).run(randomUUID(), orgId, profesorSinNotasId, estudianteId, now);

  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente Spec', ?, ?)`,
  ).run(patientId, now, estudianteId);
  for (const [id, title] of [
    [noteId, 'Sesión 1'],
    [otherNoteId, 'Sesión 2'],
  ] as const) {
    db.prepare(
      `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, patientId, title, encryptField('La paciente avanzó con psicoeducación.'), now, now, estudianteId);
  }
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

describe('SaveSupervisionReview', () => {
  it('guarda la retroalimentación con vínculo vigente y la cifra en disco', async () => {
    const review = await useCase.save(
      new SaveSupervisionReviewMessage({
        supervisorUserId: profesorId,
        sessionNoteId: noteId,
        comment: 'Buen encuadre; explora más la red de apoyo.',
      }),
    );
    expect(review.comment).toBe('Buen encuadre; explora más la red de apoyo.');
    expect(review.supervisedUserId).toBe(estudianteId);
    expect(review.reviewed).toBe(false);

    // Cifrado at-rest: la query directa NO contiene el texto en claro.
    const row = getDb()
      .prepare(`SELECT comment FROM supervision_session_reviews WHERE session_note_id = ?`)
      .get(noteId) as { comment: string };
    expect(row.comment.startsWith('enc:v1:')).toBe(true);
    expect(row.comment).not.toContain('encuadre');
  });

  it('upsert: re-guardar actualiza la MISMA fila (UNIQUE nota+supervisor)', async () => {
    const first = (await listReviews.forNotes([noteId], profesorId))[noteId];
    const updated = await useCase.save(
      new SaveSupervisionReviewMessage({
        supervisorUserId: profesorId,
        sessionNoteId: noteId,
        comment: 'Comentario corregido.',
      }),
    );
    expect(updated.id).toBe(first.id);

    const rows = getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM supervision_session_reviews
          WHERE session_note_id = ? AND supervisor_user_id = ?`,
      )
      .get(noteId, profesorId) as { n: number };
    expect(rows.n).toBe(1);
    expect((await listReviews.forNotes([noteId], profesorId))[noteId].comment).toBe('Comentario corregido.');
  });

  it('marcar como revisada conserva el comentario y aparece en reviewedNoteIds', async () => {
    const review = await useCase.save(
      new SaveSupervisionReviewMessage({
        supervisorUserId: profesorId,
        sessionNoteId: noteId,
        reviewed: true,
      }),
    );
    expect(review.reviewed).toBe(true);
    expect(review.comment).toBe('Comentario corregido.');
    expect(await listReviews.reviewedNoteIds(estudianteId, patientId)).toContain(noteId);
    expect(await listReviews.reviewedNoteIds(estudianteId, patientId)).not.toContain(otherNoteId);
  });

  it('notifica al supervisado por la campana (kind supervision) sin duplicar re-guardados', async () => {
    const notifications = () =>
      getDb()
        .prepare(
          `SELECT title, link FROM notifications
            WHERE recipient_user_id = ? AND kind = 'supervision'`,
        )
        .all(estudianteId) as unknown as Array<{ title: string; link: string }>;

    // Comentario inicial + comentario corregido + marca de revisada = 3 avisos.
    const before = notifications();
    expect(before.length).toBe(3);
    expect(before.some((n) => n.title === 'Retroalimentación de tu supervisor')).toBe(true);
    expect(before.some((n) => n.title === 'Nota revisada por tu supervisor')).toBe(true);
    expect(before[0].link).toBe(`/pacientes/${patientId}/sesiones/${noteId}`);

    // Re-guardar el MISMO comentario y la MISMA marca no genera avisos nuevos.
    await useCase.save(
      new SaveSupervisionReviewMessage({
        supervisorUserId: profesorId,
        sessionNoteId: noteId,
        comment: 'Comentario corregido.',
        reviewed: true,
      }),
    );
    expect(notifications().length).toBe(3);
  });

  it('el estudiante ve la retroalimentación con autor y fecha (solo lectura)', async () => {
    const reviews = await listReviews.forSupervisedNote(noteId, estudianteId);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].comment).toBe('Comentario corregido.');
    expect(reviews[0].reviewed).toBe(true);
    expect(reviews[0].supervisorName).toBe(profesorEmail);
  });

  it('supervisor SIN vínculo → SupervisionLinkRequiredError', async () => {
    await expect(
      useCase.save(
        new SaveSupervisionReviewMessage({
          supervisorUserId: profesorSinVinculoId,
          sessionNoteId: noteId,
          comment: 'No debería poder.',
        }),
      ),
    ).rejects.toThrow(SupervisionLinkRequiredError);
  });

  it('vínculo sin alcance de notas → SupervisionLinkRequiredError', async () => {
    await expect(
      useCase.save(
        new SaveSupervisionReviewMessage({
          supervisorUserId: profesorSinNotasId,
          sessionNoteId: noteId,
          reviewed: true,
        }),
      ),
    ).rejects.toThrow(SupervisionLinkRequiredError);
  });

  it('rechaza un mensaje sin comentario ni marca de revisión', () => {
    expect(
      () =>
        new SaveSupervisionReviewMessage({
          supervisorUserId: profesorId,
          sessionNoteId: noteId,
        }),
    ).toThrow(EmptySupervisionReviewChangeError);
  });
});
