import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Scoping por dueño (regla de oro) y cifrado at-rest de los repos SQLite clínicos:
 * SqliteDiagnosisRepository, SqlitePatientNoteRepository y
 * SqlitePatientAssessmentRepository. BD SQLite temporal real (mismo patrón que
 * tests/unit/security/RecordAccessLog.spec.ts).
 *
 * Garantías verificadas:
 *  - Un dueño NUNCA ve/borra filas de otro dueño aunque compartan patient_id.
 *  - El ON CONFLICT(id) de diagnoses no pisa una fila de otro dueño.
 *  - Las notas/comentarios se cifran at-rest (prefijo enc:v1:); puntaje/severidad
 *    quedan en claro para graficar; list() descifra de vuelta al original.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-repos-scoping-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteDiagnosisRepository: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository')['SqliteDiagnosisRepository'];
let SqlitePatientNoteRepository: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository')['SqlitePatientNoteRepository'];
let SqlitePatientAssessmentRepository: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientAssessmentRepository')['SqlitePatientAssessmentRepository'];
let Diagnosis: typeof import('@/contexts/clinical-records/domain/Diagnosis')['Diagnosis'];

const ownerA = `owner-${randomUUID()}`;
const ownerB = `owner-${randomUUID()}`;
// Caso límite a propósito: AMBOS dueños tratan al MISMO paciente compartido.
const sharedPatientId = randomUUID();
// Y A tiene además un segundo paciente, para el scoping por patient_id.
const otherPatientId = randomUUID();

function insertPatient(id: string): void {
  getDb()
    .prepare(`INSERT INTO patients (id, full_name, created_at) VALUES (?, ?, ?)`)
    .run(id, 'Paciente Prueba', new Date().toISOString());
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteDiagnosisRepository } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository'
  ));
  ({ SqlitePatientNoteRepository } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository'
  ));
  ({ SqlitePatientAssessmentRepository } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientAssessmentRepository'
  ));
  ({ Diagnosis } = await import('@/contexts/clinical-records/domain/Diagnosis'));

  // Asegura el esquema y los pacientes referenciados por las FK.
  getDb();
  insertPatient(sharedPatientId);
  insertPatient(otherPatientId);
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

function newDiagnosis(id: string, patientId: string, notes: string) {
  return Diagnosis.fromPrimitives({
    id,
    patientId,
    cie11Code: '6B00',
    cie11Title: 'Trastorno de ansiedad generalizada',
    notes,
    status: 'activo',
    kind: 'hipotesis',
    diagnosedByUserId: '',
    diagnosedAt: new Date().toISOString(),
  });
}

describe('SqliteDiagnosisRepository — regla de oro por dueño', () => {
  it('list/find/delete de un dueño NO ven filas de otro aunque compartan patient_id', async () => {
    const repoA = new SqliteDiagnosisRepository(ownerA);
    const repoB = new SqliteDiagnosisRepository(ownerB);

    const dxA = randomUUID();
    const dxB = randomUUID();
    await repoA.save(newDiagnosis(dxA, sharedPatientId, 'de A'));
    await repoB.save(newDiagnosis(dxB, sharedPatientId, 'de B'));

    // listByPatient: cada dueño sólo ve lo suyo, pese al mismo paciente.
    const listA = await repoA.listByPatient(sharedPatientId);
    const listB = await repoB.listByPatient(sharedPatientId);
    expect(listA.map((d) => d.diagnosisId())).toEqual([dxA]);
    expect(listB.map((d) => d.diagnosisId())).toEqual([dxB]);

    // findById: A no encuentra el diagnóstico de B (ni viceversa).
    expect(await repoA.findById(dxB)).toBeNull();
    expect(await repoB.findById(dxA)).toBeNull();
    expect((await repoA.findById(dxA))?.diagnosisId()).toBe(dxA);

    // delete: A no puede borrar el de B.
    await repoA.delete(dxB);
    expect((await repoB.findById(dxB))?.diagnosisId()).toBe(dxB);

    // Limpieza para no interferir con el siguiente caso.
    await repoA.delete(dxA);
    await repoB.delete(dxB);
  });

  it('[integridad cross-owner] save (ON CONFLICT id) NO pisa una fila de otro dueño', async () => {
    const repoA = new SqliteDiagnosisRepository(ownerA);
    const repoB = new SqliteDiagnosisRepository(ownerB);
    const sharedId = randomUUID();

    // B inserta primero su fila con ese id.
    await repoB.save(newDiagnosis(sharedId, sharedPatientId, 'original de B'));

    // A intenta save() con el MISMO id pero distintos datos: el ON CONFLICT(id)
    // dispara, pero el WHERE owner_user_id = excluded.owner_user_id lo bloquea.
    await repoA.save(newDiagnosis(sharedId, sharedPatientId, 'intento de A'));

    // La fila de B no cambió.
    const rowB = await repoB.findById(sharedId);
    expect(rowB?.toPrimitives().notes).toBe('original de B');

    // A sigue sin ver esa fila (no se "robó" al hacer el insert/update).
    expect(await repoA.findById(sharedId)).toBeNull();

    // Comprobación cruda: una sola fila, con el owner de B.
    const rows = getDb()
      .prepare('SELECT owner_user_id, notes FROM diagnoses WHERE id = ?')
      .all(sharedId) as { owner_user_id: string; notes: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ owner_user_id: ownerB, notes: 'original de B' });

    await repoB.delete(sharedId);
  });
});

describe('SqlitePatientNoteRepository — cifrado at-rest y scoping', () => {
  it('add cifra el body at-rest (enc:v1:) y list() lo descifra al original', async () => {
    const repoA = new SqlitePatientNoteRepository(ownerA);
    const plano = 'Apunte privado: el paciente reportó insomnio.';
    await repoA.add(sharedPatientId, plano);

    // Fila cruda: el body NO está en claro y empieza por enc:v1:.
    const raw = getDb()
      .prepare('SELECT body FROM patient_notes WHERE owner_user_id = ? AND patient_id = ?')
      .get(ownerA, sharedPatientId) as { body: string };
    expect(raw.body.startsWith('enc:v1:')).toBe(true);
    expect(raw.body).not.toContain('insomnio');

    // list() descifra de vuelta.
    const notes = await repoA.list(sharedPatientId);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe(plano);
  });

  it('list y delete acotados por owner_user_id AND patient_id', async () => {
    const repoA = new SqlitePatientNoteRepository(ownerA);
    const repoB = new SqlitePatientNoteRepository(ownerB);

    // B añade una nota al MISMO paciente; A añade otra a SU otro paciente.
    await repoB.add(sharedPatientId, 'nota de B');
    await repoA.add(otherPatientId, 'nota de A en otro paciente');

    // A en el paciente compartido sólo ve su propia nota (la del caso anterior).
    const aShared = await repoA.list(sharedPatientId);
    expect(aShared).toHaveLength(1);
    expect(aShared[0].body).toBe('Apunte privado: el paciente reportó insomnio.');

    // A no ve la nota de B (otro dueño) ni la mezcla del otro paciente.
    expect(aShared.some((n) => n.body === 'nota de B')).toBe(false);

    // delete cross-owner: A intenta borrar la nota de B → no la borra.
    const bNote = (await repoB.list(sharedPatientId)).find((n) => n.body === 'nota de B')!;
    await repoA.delete(bNote.id, sharedPatientId);
    expect((await repoB.list(sharedPatientId)).some((n) => n.id === bNote.id)).toBe(true);

    // delete cross-patient: A intenta borrar su nota del compartido pasando otro patient_id → no la borra.
    const aNote = (await repoA.list(sharedPatientId))[0];
    await repoA.delete(aNote.id, otherPatientId);
    expect((await repoA.list(sharedPatientId)).some((n) => n.id === aNote.id)).toBe(true);

    // Con el patient_id correcto sí borra (sólo lo suyo).
    await repoA.delete(aNote.id, sharedPatientId);
    expect(await repoA.list(sharedPatientId)).toHaveLength(0);
  });
});

describe('SqlitePatientAssessmentRepository — cifrado parcial y scoping', () => {
  it('add cifra notes at-rest pero deja total_score/severity en claro; list() descifra notes', async () => {
    const repoA = new SqlitePatientAssessmentRepository(ownerA);
    const comentario = 'El paciente mencionó ideas pasivas; vigilar ítem 9.';
    await repoA.add(sharedPatientId, {
      instrumentId: 'phq-9',
      answers: [1, 2, 3, 0, 1, 2, 1, 0, 1],
      totalScore: 11,
      severity: 'moderada',
      riskFlag: true,
      notes: comentario,
    });

    // Fila cruda: notes cifrado; total_score y severity legibles directo (para graficar).
    const raw = getDb()
      .prepare(
        'SELECT notes, total_score, severity FROM patient_assessments WHERE owner_user_id = ? AND patient_id = ?',
      )
      .get(ownerA, sharedPatientId) as { notes: string; total_score: number; severity: string };
    expect(raw.notes.startsWith('enc:v1:')).toBe(true);
    expect(raw.notes).not.toContain('ítem 9');
    expect(raw.total_score).toBe(11);
    expect(raw.severity).toBe('moderada');

    // list() descifra el comentario y conserva puntaje/severidad/riskFlag.
    const list = await repoA.list(sharedPatientId);
    expect(list).toHaveLength(1);
    expect(list[0].notes).toBe(comentario);
    expect(list[0].totalScore).toBe(11);
    expect(list[0].severity).toBe('moderada');
    expect(list[0].riskFlag).toBe(true);
  });

  it('list y delete acotados por owner_user_id AND patient_id', async () => {
    const repoA = new SqlitePatientAssessmentRepository(ownerA);
    const repoB = new SqlitePatientAssessmentRepository(ownerB);

    // B aplica un cuestionario al MISMO paciente.
    await repoB.add(sharedPatientId, {
      instrumentId: 'gad-7',
      answers: [1, 1, 1, 1, 1, 1, 1],
      totalScore: 7,
      severity: 'leve',
      riskFlag: false,
      notes: 'comentario de B',
    });

    // A sólo ve su aplicación (la del caso anterior), no la de B.
    const aList = await repoA.list(sharedPatientId);
    expect(aList).toHaveLength(1);
    expect(aList[0].instrumentId).toBe('phq-9');
    expect(aList.some((a) => a.instrumentId === 'gad-7')).toBe(false);

    // delete cross-owner: A no puede borrar la aplicación de B.
    const bAssessment = (await repoB.list(sharedPatientId)).find((a) => a.instrumentId === 'gad-7')!;
    await repoA.delete(bAssessment.id, sharedPatientId);
    expect((await repoB.list(sharedPatientId)).some((a) => a.id === bAssessment.id)).toBe(true);

    // delete cross-patient: patient_id equivocado no borra.
    const aAssessment = (await repoA.list(sharedPatientId))[0];
    await repoA.delete(aAssessment.id, otherPatientId);
    expect((await repoA.list(sharedPatientId)).some((a) => a.id === aAssessment.id)).toBe(true);

    // Con dueño y paciente correctos sí borra.
    await repoA.delete(aAssessment.id, sharedPatientId);
    expect(await repoA.list(sharedPatientId)).toHaveLength(0);
  });
});
