import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Pase de arranque del cifrado at-rest (v3 §1.1): cifra filas preexistentes en
 * claro, es idempotente (marker en platform_settings) y tolera filas ya
 * cifradas o vacías.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-cifrado-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let encryptExistingClinicalData: typeof import('@/shared/infrastructure/persistence/clinicalEncryption')['encryptExistingClinicalData'];
let encryptField: typeof import('@/shared/infrastructure/crypto/FieldEncryption')['encryptField'];
let decryptField: typeof import('@/shared/infrastructure/crypto/FieldEncryption')['decryptField'];

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ encryptExistingClinicalData } = await import(
    '@/shared/infrastructure/persistence/clinicalEncryption'
  ));
  ({ encryptField, decryptField } = await import('@/shared/infrastructure/crypto/FieldEncryption'));
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

describe('encryptExistingClinicalData', () => {
  it('cifra filas en claro, salta las cifradas y es idempotente', () => {
    const db = getDb(); // ya corrió el pase inicial al abrir

    const owner = `owner-${randomUUID()}`;
    const patientId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)`,
    ).run(patientId, 'Paciente Cifrado', now, owner);

    const plainNoteId = randomUUID();
    const encryptedNoteId = randomUUID();
    const emptyNoteId = randomUUID();
    const insertNote = db.prepare(
      `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertNote.run(plainNoteId, patientId, 'Nota en claro', 'contenido sensible', now, now, owner);
    const preEncrypted = encryptField('ya estaba cifrada');
    insertNote.run(encryptedNoteId, patientId, 'Nota cifrada', preEncrypted, now, now, owner);
    insertNote.run(emptyNoteId, patientId, 'Nota vacía', '', now, now, owner);

    // patient_notes.body en claro (como el backfill v29): debe quedar cifrado tras el pase (A3).
    const privateNoteId = randomUUID();
    db.prepare(
      `INSERT INTO patient_notes (id, owner_user_id, patient_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(privateNoteId, owner, patientId, 'bitácora privada en claro', now);

    // Borra el marker para forzar una nueva corrida del pase.
    db.prepare('DELETE FROM platform_settings WHERE key = ?').run('clinical_encryption');
    encryptExistingClinicalData(db);

    const privateBody = (db.prepare('SELECT body FROM patient_notes WHERE id = ?').get(privateNoteId) as { body: string }).body;
    expect(privateBody.startsWith('enc:v1:')).toBe(true);
    expect(decryptField(privateBody)).toBe('bitácora privada en claro');

    const contentOf = (id: string): string =>
      (db.prepare('SELECT content FROM session_notes WHERE id = ?').get(id) as { content: string })
        .content;

    expect(contentOf(plainNoteId).startsWith('enc:v1:')).toBe(true);
    expect(decryptField(contentOf(plainNoteId))).toBe('contenido sensible');
    expect(contentOf(encryptedNoteId)).toBe(preEncrypted); // no doble-cifra
    expect(contentOf(emptyNoteId)).toBe(''); // vacíos se saltan

    // Idempotencia: con el marker puesto, una fila nueva en claro NO se toca.
    const afterMarkerId = randomUUID();
    insertNote.run(afterMarkerId, patientId, 'Posterior', 'en claro tras marker', now, now, owner);
    encryptExistingClinicalData(db);
    expect(contentOf(afterMarkerId)).toBe('en claro tras marker');

    const marker = db
      .prepare('SELECT value_json FROM platform_settings WHERE key = ?')
      .get('clinical_encryption') as { value_json: string };
    // v6 = ai_chat_threads.title (extracto de la primera pregunta clínica).
    expect(JSON.parse(marker.value_json).version).toBe(6);
  });
});
