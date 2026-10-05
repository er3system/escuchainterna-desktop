import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreatePatient } from '@/contexts/patients/application/create-patient/CreatePatient';
import { CreatePatientMessage } from '@/contexts/patients/application/create-patient/CreatePatientMessage';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { Patient } from '@/contexts/patients/domain/Patient';

/**
 * Test de scoping multi-tenant contra SQLite real (BD temporal):
 * dos dueños distintos NUNCA ven los pacientes del otro.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-scoping-'));
const dbPath = path.join(tempDir, 'test.db');

let SqlitePatientRepository: typeof import('@/contexts/patients/infrastructure/persistence/SqlitePatientRepository')['SqlitePatientRepository'];
let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  // El catálogo CIE-11 no hace falta para este test (y ralentiza el seed).
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePatientRepository } = await import(
    '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository'
  ));
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

describe('Scoping por owner_user_id', () => {
  const ownerA = `owner-a-${randomUUID()}`;
  const ownerB = `owner-b-${randomUUID()}`;

  it('cada dueño solo ve sus propios pacientes', async () => {
    const repoA = new SqlitePatientRepository(ownerA);
    const repoB = new SqlitePatientRepository(ownerB);

    await new CreatePatient(repoA).create(new CreatePatientMessage({ fullName: 'Paciente De Ana' }));
    await new CreatePatient(repoB).create(new CreatePatientMessage({ fullName: 'Paciente De Bruno' }));

    const visiblesParaA = await new SearchPatients(repoA).search(
      new SearchPatientsQuery({ includeArchived: true }),
    );
    const visiblesParaB = await new SearchPatients(repoB).search(
      new SearchPatientsQuery({ includeArchived: true }),
    );

    expect(visiblesParaA.map((patient) => patient.fullName)).toEqual(['Paciente De Ana']);
    expect(visiblesParaB.map((patient) => patient.fullName)).toEqual(['Paciente De Bruno']);
  });

  it('findById de otro dueño devuelve null aunque el id exista', async () => {
    const repoA = new SqlitePatientRepository(ownerA);
    const repoB = new SqlitePatientRepository(ownerB);

    const patientId = await new CreatePatient(repoA).create(
      new CreatePatientMessage({ fullName: 'Paciente Privado' }),
    );

    expect(await repoA.findById(patientId)).not.toBeNull();
    expect(await repoB.findById(patientId)).toBeNull();
  });

  it('un dueño no puede sobrescribir el paciente de otro (save con owner ajeno no aplica)', async () => {
    const repoA = new SqlitePatientRepository(ownerA);
    const repoB = new SqlitePatientRepository(ownerB);

    const patientId = await new CreatePatient(repoA).create(
      new CreatePatientMessage({ fullName: 'Nombre Original' }),
    );

    const original = (await repoA.findById(patientId))!;
    // El repo de B intenta "actualizar" el mismo id: el upsert condicionado por owner no debe tocarlo.
    const ajeno = { ...original.toPrimitives(), fullName: 'Hackeado' };
    try {
      await repoB.save(Patient.fromPrimitives(ajeno));
    } catch {
      // si el repo decide lanzar, también es un comportamiento válido de aislamiento
    }

    expect((await repoA.findById(patientId))!.toPrimitives().fullName).toBe('Nombre Original');
  });
});
