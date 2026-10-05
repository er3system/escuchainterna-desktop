import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SummarizeCaseForSupervision } from '@/contexts/identity/application/summarize-case-for-supervision/SummarizeCaseForSupervision';
import { SummarizeCaseForSupervisionMessage } from '@/contexts/identity/application/summarize-case-for-supervision/SummarizeCaseForSupervisionMessage';
import { SupervisionLinkRequiredError } from '@/contexts/identity/domain/errors/SupervisionLinkRequiredError';
import type { SupervisionCaseData } from '@/contexts/clinical-records/domain/SessionInsights';

/**
 * Resumen del caso (IA) para el supervisor (v3.2): el read model solo arma el
 * contexto a través de un vínculo de supervisión vigente (estructural, en la
 * query); sin vínculo, la IA queda bloqueada con SupervisionLinkRequiredError.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-resumen-supervision-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let reader: import('@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader').SqliteSupervisionAccessReader;

const orgId = `org-${randomUUID()}`;
const profesorId = `profesor-${randomUUID()}`;
const profesorSinVinculoId = `intruso-${randomUUID()}`;
const estudianteId = `estudiante-${randomUUID()}`;
const otroPsicologoId = `ajeno-${randomUUID()}`;
const patientId = `paciente-${randomUUID()}`;
const foreignPatientId = `paciente-ajeno-${randomUUID()}`;

/** Doble del puerto: captura el contexto recibido y devuelve un texto fijo. */
function fakeSummarizer() {
  const captured: SupervisionCaseData[] = [];
  return {
    captured,
    summarizeCaseForSupervision: async (caseData: SupervisionCaseData) => {
      captured.push(caseData);
      return 'RESUMEN-DE-PRUEBA';
    },
  };
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { encryptField } = await import('@/shared/infrastructure/crypto/FieldEncryption');
  const { SqliteSupervisionAccessReader } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader'
  );
  reader = new SqliteSupervisionAccessReader();

  const db = getDb();
  const now = new Date().toISOString();
  for (const [id, email, role] of [
    [profesorId, 'profesor@resumen.test', 'professor'],
    [profesorSinVinculoId, 'intruso@resumen.test', 'professor'],
    [estudianteId, 'estudiante@resumen.test', 'psychologist'],
    [otroPsicologoId, 'ajeno@resumen.test', 'psychologist'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, 'hash', ?, 'activo', ?)`,
    ).run(id, email, role, now);
  }
  db.prepare(
    `INSERT INTO organizations (id, name, slug, kind, created_at) VALUES (?, 'Uni Resumen', ?, 'universidad', ?)`,
  ).run(orgId, `uni-resumen-${randomUUID()}`, now);
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, '{"notas":true,"historias":true,"pagos":false}', ?)`,
  ).run(randomUUID(), orgId, profesorId, estudianteId, now);

  // Paciente del supervisado, con dos notas cifradas, una historia y un diagnóstico.
  db.prepare(
    `INSERT INTO patients (id, full_name, gender, consultation_reason, created_at, owner_user_id)
     VALUES (?, 'Paciente Resumen', 'Femenino', 'Ansiedad laboral', ?, ?)`,
  ).run(patientId, now, estudianteId);
  const earlier = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Primera sesión', ?, ?, ?, ?)`,
  ).run(randomUUID(), patientId, encryptField('Se trabajó psicoeducación sobre la ansiedad.'), earlier, earlier, estudianteId);
  db.prepare(
    `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Segunda sesión', ?, ?, ?, ?)`,
  ).run(randomUUID(), patientId, encryptField('Ejercicio de respiración diafragmática con buena respuesta.'), now, now, estudianteId);
  db.prepare(
    `INSERT INTO clinical_records (id, patient_id, title, created_at, updated_at, owner_user_id)
     VALUES (?, ?, 'Historia inicial', ?, ?, ?)`,
  ).run(randomUUID(), patientId, now, now, estudianteId);
  db.prepare(
    `INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, status, diagnosed_at, owner_user_id)
     VALUES (?, ?, '6B00', 'Trastorno de ansiedad generalizada', 'activo', ?, ?)`,
  ).run(randomUUID(), patientId, now, estudianteId);

  // Paciente de OTRO psicólogo (sin vínculo con el profesor).
  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente Ajeno', ?, ?)`,
  ).run(foreignPatientId, now, otroPsicologoId);
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

describe('SummarizeCaseForSupervision', () => {
  it('sin vínculo de supervisión la IA queda bloqueada', async () => {
    const summarizer = fakeSummarizer();
    const useCase = new SummarizeCaseForSupervision(reader, summarizer);
    await expect(
      useCase.summarize(
        new SummarizeCaseForSupervisionMessage({
          supervisorUserId: profesorSinVinculoId,
          supervisedUserId: estudianteId,
          patientId,
        }),
      ),
    ).rejects.toThrow(SupervisionLinkRequiredError);
    expect(summarizer.captured).toHaveLength(0);
  });

  it('con vínculo: arma el contexto con notas DESCIFRADAS en orden cronológico', async () => {
    const summarizer = fakeSummarizer();
    const useCase = new SummarizeCaseForSupervision(reader, summarizer);
    const summary = await useCase.summarize(
      new SummarizeCaseForSupervisionMessage({
        supervisorUserId: profesorId,
        supervisedUserId: estudianteId,
        patientId,
      }),
    );
    expect(summary).toBe('RESUMEN-DE-PRUEBA');

    const caseData = summarizer.captured[0];
    expect(caseData.patientName).toBe('Paciente Resumen');
    expect(caseData.supervisedName).toBe('estudiante@resumen.test');
    expect(caseData.notes).toHaveLength(2);
    expect(caseData.notes[0].content).toBe('Se trabajó psicoeducación sobre la ansiedad.');
    expect(caseData.notes[1].content).toBe('Ejercicio de respiración diafragmática con buena respuesta.');
    expect(caseData.records[0].templateName).toBe('Formato libre');
    expect(caseData.diagnoses[0]).toEqual({
      code: '6B00',
      title: 'Trastorno de ansiedad generalizada',
      status: 'activo',
    });
  });

  it('un paciente que NO es del supervisado no es alcanzable ni con vínculo', async () => {
    const summarizer = fakeSummarizer();
    const useCase = new SummarizeCaseForSupervision(reader, summarizer);
    await expect(
      useCase.summarize(
        new SummarizeCaseForSupervisionMessage({
          supervisorUserId: profesorId,
          supervisedUserId: estudianteId,
          patientId: foreignPatientId,
        }),
      ),
    ).rejects.toThrow(SupervisionLinkRequiredError);
  });
});

describe('LocalSessionInsights.summarizeCaseForSupervision (heurístico honesto)', () => {
  it('produce las secciones acordadas, cita fuentes y reporta solo menciones literales', async () => {
    const { LocalSessionInsights } = await import(
      '@/contexts/clinical-records/infrastructure/ai/LocalSessionInsights'
    );
    const caseData = await reader.loadCase(profesorId, estudianteId, patientId);
    expect(caseData).not.toBeNull();
    const summary = await new LocalSessionInsights('Profesora Spec').summarizeCaseForSupervision(
      caseData!,
    );
    expect(summary).toContain('## Qué se ha trabajado');
    expect(summary).toContain('## Técnicas e intervenciones registradas');
    expect(summary).toContain('## Evolución temporal');
    expect(summary).toContain('## Historia clínica y diagnósticos');
    // Mención literal de técnica detectada en las notas.
    expect(summary).toContain('psicoeducación');
    expect(summary).toContain('6B00');
    // Honestidad del modo local.
    expect(summary).toContain('modo local');
    // Citas a la fuente: hay una sección de fuentes y al menos una cita [n].
    expect(summary).toContain('## Fuentes');
    expect(summary).toMatch(/\[\d+\]/);
    // Sección de huecos siempre presente; con diagnóstico y notas, no aparece el
    // hueco de diagnóstico.
    expect(summary).toContain('## Lo que no consta en el expediente');
    expect(summary).not.toContain('No hay un diagnóstico CIE-11 registrado.');
  });

  it('sin diagnóstico, la sección de huecos lista el diagnóstico faltante', async () => {
    const { LocalSessionInsights } = await import(
      '@/contexts/clinical-records/infrastructure/ai/LocalSessionInsights'
    );
    const caseData = await reader.loadCase(profesorId, estudianteId, patientId);
    expect(caseData).not.toBeNull();
    const sinDiagnostico = { ...caseData!, diagnoses: [] };
    const summary = await new LocalSessionInsights('Profesora Spec').summarizeCaseForSupervision(
      sinDiagnostico,
    );
    expect(summary).toContain('## Lo que no consta en el expediente');
    expect(summary).toContain('No hay un diagnóstico CIE-11 registrado.');
  });
});
