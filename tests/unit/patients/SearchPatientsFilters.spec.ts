import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import type { SearchPatientsInput } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { documentBlindIndex } from '@/shared/infrastructure/persistence/patientPiiEncryption';

/**
 * Filtros de la lista de pacientes (/pacientes) contra SQLite real:
 * etiqueta, estado, género, diagnóstico activo, última sesión y próxima cita.
 * Cada filtro combina con los demás (AND) y se acota por owner_user_id.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-filtros-'));
const dbPath = path.join(tempDir, 'test.db');

let SqlitePatientRepository: typeof import('@/contexts/patients/infrastructure/persistence/SqlitePatientRepository')['SqlitePatientRepository'];
let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];

const owner = `owner-${randomUUID()}`;
const otherOwner = `other-${randomUUID()}`;
const agendaId = `agenda-${randomUUID()}`;

// Ids estables para referenciar en aserciones.
const ID = {
  ana: randomUUID(), // femenino, etiqueta VIP, diagnóstico activo, sesión este mes, cita futura
  bruno: randomUUID(), // masculino, sin diagnóstico, última sesión hace 4 meses, sin cita
  carla: randomUUID(), // femenino, diagnóstico descartado, última sesión hace 8 meses
  dario: randomUUID(), // sin género, sin sesiones, archivado
  elena: randomUUID(), // de OTRO dueño (no debe aparecer)
};

function insertPatient(
  id: string,
  ownerUserId: string,
  fields: { name: string; gender?: string; tags?: string[]; archived?: boolean; documentNumber?: string },
): void {
  getDb()
    .prepare(
      `INSERT INTO patients (id, full_name, gender, tags_json, archived, document_number, document_hash, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      fields.name,
      fields.gender ?? '',
      JSON.stringify(fields.tags ?? []),
      fields.archived ? 1 : 0,
      fields.documentNumber ?? '',
      // El documento se cifra at-rest; la búsqueda EXACTA va por su índice ciego.
      documentBlindIndex(fields.documentNumber ?? ''),
      new Date('2024-01-01').toISOString(),
      ownerUserId,
    );
}

function insertDiagnosis(patientId: string, ownerUserId: string, status: string): void {
  getDb()
    .prepare(
      `INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, status, diagnosed_at, owner_user_id)
       VALUES (?, ?, '6A70', 'Episodio depresivo', ?, ?, ?)`,
    )
    .run(randomUUID(), patientId, status, new Date('2024-02-01').toISOString(), ownerUserId);
}

function insertBooking(
  patientId: string,
  ownerUserId: string,
  startAt: Date,
  status = 'completada',
): void {
  getDb()
    .prepare(
      `INSERT INTO bookings (id, agenda_id, patient_id, start_at, end_at, status, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      agendaId,
      patientId,
      startAt.toISOString(),
      new Date(startAt.getTime() + 3600_000).toISOString(),
      status,
      new Date('2024-01-01').toISOString(),
      ownerUserId,
    );
}

async function search(input: SearchPatientsInput): Promise<string[]> {
  const repo = new SqlitePatientRepository(owner);
  return (await new SearchPatients(repo).search(new SearchPatientsQuery(input))).map((p) => p.id);
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePatientRepository } = await import(
    '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository'
  ));

  // Agenda mínima para satisfacer la FK bookings.agenda_id → agendas.id.
  getDb()
    .prepare(
      `INSERT INTO agendas (id, name, slug, created_at, owner_user_id)
       VALUES (?, 'Agenda de prueba', ?, ?, ?)`,
    )
    .run(agendaId, `slug-${agendaId}`, new Date('2024-01-01').toISOString(), owner);

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000);

  insertPatient(ID.ana, owner, {
    name: 'Ana López',
    gender: 'femenino',
    tags: ['VIP', 'Adultos'],
    documentNumber: '1098765432',
  });
  insertPatient(ID.bruno, owner, { name: 'Bruno Díaz', gender: 'masculino', tags: ['Adultos'] });
  insertPatient(ID.carla, owner, { name: 'Carla Ruiz', gender: 'femenino', tags: ['VIP'] });
  insertPatient(ID.dario, owner, { name: 'Darío Mora', archived: true });
  insertPatient(ID.elena, otherOwner, { name: 'Elena Ajena', gender: 'femenino', tags: ['VIP'] });

  insertDiagnosis(ID.ana, owner, 'activo');
  insertDiagnosis(ID.carla, owner, 'descartado'); // no cuenta como activo
  insertDiagnosis(ID.elena, otherOwner, 'activo'); // de otro dueño

  // Ana: sesión el día 1 del mes actual (siempre "este mes") + cita futura.
  const today = new Date(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
  insertBooking(ID.ana, owner, monthStart); // sesión de este mes
  insertBooking(ID.ana, owner, new Date(now + 7 * 86_400_000), 'agendada'); // próxima cita
  // Bruno: última sesión hace ~4 meses (>3, <6).
  insertBooking(ID.bruno, owner, daysAgo(120));
  // Carla: última sesión hace ~8 meses (>6).
  insertBooking(ID.carla, owner, daysAgo(240));
  // Darío: sin sesiones.
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

describe('SearchPatients — filtros de la lista', () => {
  it('por defecto solo muestra activos del dueño (sin Darío archivado ni Elena ajena)', async () => {
    expect((await search({})).sort()).toEqual([ID.ana, ID.bruno, ID.carla].sort());
  });

  it('estado: archivados muestra solo archivados; todos incluye al archivado', async () => {
    expect(await search({ archived: 'archivados' })).toEqual([ID.dario]);
    expect((await search({ archived: 'todos' })).sort()).toEqual(
      [ID.ana, ID.bruno, ID.carla, ID.dario].sort(),
    );
  });

  it('etiqueta: filtra por etiqueta exacta del array tags_json', async () => {
    expect((await search({ tag: 'VIP' })).sort()).toEqual([ID.ana, ID.carla].sort());
    expect((await search({ tag: 'Adultos' })).sort()).toEqual([ID.ana, ID.bruno].sort());
    expect(await search({ tag: 'NoExiste' })).toEqual([]);
  });

  it('género: filtra por valor exacto', async () => {
    expect((await search({ gender: 'femenino' })).sort()).toEqual([ID.ana, ID.carla].sort());
    expect(await search({ gender: 'masculino' })).toEqual([ID.bruno]);
  });

  it('diagnóstico: con/sin activo (descartado NO cuenta como activo)', async () => {
    expect(await search({ diagnosis: 'con' })).toEqual([ID.ana]);
    expect((await search({ diagnosis: 'sin' })).sort()).toEqual([ID.bruno, ID.carla].sort());
  });

  it('última sesión: sin sesiones / este mes / +3 meses / +6 meses', async () => {
    // Darío (archivado, sin sesiones) requiere incluir archivados para verse.
    expect(await search({ archived: 'todos', lastSession: 'sin' })).toEqual([ID.dario]);
    expect(await search({ lastSession: 'este_mes' })).toEqual([ID.ana]);
    // +3 meses: Bruno (4m) y Carla (8m) tienen sesiones pero ninguna en los últimos 3 meses.
    expect((await search({ lastSession: 'mas_3_meses' })).sort()).toEqual([ID.bruno, ID.carla].sort());
    // +6 meses: solo Carla (8m).
    expect(await search({ lastSession: 'mas_6_meses' })).toEqual([ID.carla]);
  });

  it('próxima cita: con/sin cita futura (solo Ana tiene cita futura)', async () => {
    expect(await search({ nextAppointment: 'con' })).toEqual([ID.ana]);
    expect((await search({ nextAppointment: 'sin' })).sort()).toEqual([ID.bruno, ID.carla].sort());
  });

  it('combina filtros con AND (femenino + VIP + con diagnóstico = solo Ana)', async () => {
    expect(await search({ gender: 'femenino', tag: 'VIP', diagnosis: 'con' })).toEqual([ID.ana]);
    // femenino + VIP sin diagnóstico activo = Carla.
    expect(await search({ gender: 'femenino', tag: 'VIP', diagnosis: 'sin' })).toEqual([ID.carla]);
  });

  it('combina texto de búsqueda con los filtros', async () => {
    expect(await search({ text: 'ruiz', gender: 'femenino' })).toEqual([ID.carla]);
    expect(await search({ text: 'ana', diagnosis: 'sin' })).toEqual([]);
  });

  it('busca por documento EXACTO vía índice ciego (cifrado at-rest: ya no por subcadena)', async () => {
    expect(await search({ text: '1098765432' })).toEqual([ID.ana]); // documento completo → encontrado
    expect(await search({ text: '109876' })).toEqual([]); // parcial ya NO casa: el documento está cifrado
    expect(await search({ text: '0000000' })).toEqual([]);
  });

  it('distinctTags devuelve las etiquetas del dueño ordenadas y sin las del otro dueño', async () => {
    const repo = new SqlitePatientRepository(owner);
    expect(await repo.distinctTags()).toEqual(['Adultos', 'VIP']);
  });
});
