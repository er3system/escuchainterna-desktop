import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PatientSummaryUpdate } from '@/contexts/clinical-records/domain/repositories/PatientDirectory';

/**
 * Cifrado at-rest de la PII de la ficha del paciente (v5): las columnas solo-display viajan
 * cifradas en la BD y el documento se busca por índice ciego (document_hash). Nombre/email/teléfono
 * quedan en claro a propósito (búsqueda/orden).
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-pii-pac-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqlitePatientDirectory: typeof import('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory')['SqlitePatientDirectory'];
let documentBlindIndex: typeof import('@/shared/infrastructure/persistence/patientPiiEncryption')['documentBlindIndex'];

const owner = `owner-${randomUUID()}`;
const patientId = randomUUID();

const PII: PatientSummaryUpdate = {
  fullName: 'Ana López',
  email: 'ana@correo.test',
  phone: '3001234567',
  birthDate: '1990-05-01',
  gender: 'femenino',
  consultationReason: 'ansiedad por el trabajo',
  therapyStartDate: '2026-01-10',
  emergencyContactName: 'Pedro López',
  emergencyContactPhone: '3009998888',
  notes: 'paciente puntual; vive con su madre',
  tags: ['VIP'],
  documentType: 'CC',
  documentNumber: '1098765432',
  guardianName: 'María López',
  guardianRelationship: 'madre',
  guardianDocument: 'CC 555',
  currentMedication: 'sertralina 50mg',
  medicalHistory: 'hipotiroidismo',
  sessionFrequency: 'semanal',
  sessionModality: 'virtual',
  processStatus: 'activo',
  treatmentEndDate: null,
  treatmentEndReason: '',
  insuranceName: 'Sura',
  insurancePolicyNumber: 'POL-123',
  referralSource: 'colega',
  customFields: [{ label: 'Ocupación', value: 'diseñadora' }],
};

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePatientDirectory } = await import(
    '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory'
  ));
  ({ documentBlindIndex } = await import(
    '@/shared/infrastructure/persistence/patientPiiEncryption'
  ));

  const now = new Date().toISOString();
  getDb()
    .prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)`)
    .run(patientId, 'temporal', now, owner);
  // updateSummary escribe la PII cifrada (vía el repo, no el backfill) y el document_hash.
  await new SqlitePatientDirectory(owner).updateSummary(patientId, PII);
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

describe('Cifrado at-rest de la PII del paciente', () => {
  it('round-trip: findSummary devuelve la PII EN CLARO', async () => {
    const summary = (await new SqlitePatientDirectory(owner).findSummary(patientId))!;
    expect(summary.notes).toBe(PII.notes);
    expect(summary.medicalHistory).toBe(PII.medicalHistory);
    expect(summary.currentMedication).toBe(PII.currentMedication);
    expect(summary.documentNumber).toBe(PII.documentNumber);
    expect(summary.insurancePolicyNumber).toBe(PII.insurancePolicyNumber);
    expect(summary.guardianName).toBe(PII.guardianName);
    expect(summary.consultationReason).toBe(PII.consultationReason);
    expect(summary.referralSource).toBe(PII.referralSource);
    expect(summary.customFields).toEqual(PII.customFields);
    expect(summary.fullName).toBe(PII.fullName);
  });

  it('at-rest: las columnas PII están CIFRADAS en la BD; el nombre queda en claro', () => {
    const row = getDb()
      .prepare(
        `SELECT full_name, notes, medical_history, current_medication, document_number,
                document_hash, insurance_policy_number, custom_fields_json
           FROM patients WHERE id = ?`,
      )
      .get(patientId) as Record<string, string>;

    for (const col of [
      'notes',
      'medical_history',
      'current_medication',
      'document_number',
      'insurance_policy_number',
      'custom_fields_json',
    ]) {
      expect(row[col].startsWith('enc:v1:')).toBe(true);
    }
    // El nombre NO se cifra (búsqueda/orden).
    expect(row.full_name).toBe(PII.fullName);
    // El documento NO aparece en claro en ninguna parte; el hash es el índice ciego determinista.
    expect(row.document_number).not.toContain(PII.documentNumber);
    expect(row.document_hash).toBe(documentBlindIndex(PII.documentNumber));
  });

  it('deduplicación por documento EXACTO vía índice ciego', async () => {
    const directory = new SqlitePatientDirectory(owner);
    const dup = await directory.findDuplicateByDocument(PII.documentNumber);
    expect(dup?.id).toBe(patientId);
    expect(dup?.fullName).toBe(PII.fullName); // full_name en claro
    // Excluir al propio paciente → sin duplicado.
    expect(await directory.findDuplicateByDocument(PII.documentNumber, patientId)).toBeNull();
    // Otro documento no casa.
    expect(await directory.findDuplicateByDocument('0000000000')).toBeNull();
  });
});
