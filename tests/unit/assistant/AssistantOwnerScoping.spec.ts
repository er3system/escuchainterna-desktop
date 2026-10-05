import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ChatThread } from '@/contexts/assistant/domain/ChatThread';
import { ChatMessage } from '@/contexts/assistant/domain/ChatMessage';

/**
 * Guardrail nº 1 contra SQLite real (BD temporal): el retriever y el
 * repositorio de hilos del asistente NUNCA cruzan datos entre dueños.
 * El filtro vive en la consulta SQL, no en el prompt.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-assistant-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let getDatabaseAdapter: typeof import('@/shared/infrastructure/persistence/SqliteAdapter')['getDatabaseAdapter'];
let SqlitePatientContextRetriever: typeof import('@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever')['SqlitePatientContextRetriever'];
let SqliteChatThreadRepository: typeof import('@/contexts/assistant/infrastructure/persistence/SqliteChatThreadRepository')['SqliteChatThreadRepository'];

/** Gate permisivo: estos tests verifican el SCOPING por dueño, no el consentimiento-IA. */
const consintiente = { isAuthorized: async () => true };

const ownerA = `owner-a-${randomUUID()}`;
const ownerB = `owner-b-${randomUUID()}`;
const patientA = randomUUID();
const patientB = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ getDatabaseAdapter } = await import('@/shared/infrastructure/persistence/SqliteAdapter'));
  ({ SqlitePatientContextRetriever } = await import(
    '@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever'
  ));
  ({ SqliteChatThreadRepository } = await import(
    '@/contexts/assistant/infrastructure/persistence/SqliteChatThreadRepository'
  ));

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare('INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)').run(
    patientA,
    'Paciente De Ana',
    now,
    ownerA,
  );
  db.prepare('INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)').run(
    patientB,
    'Paciente De Bruno',
    now,
    ownerB,
  );

  // Nota del propio dueño A sobre su paciente.
  db.prepare(
    'INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), patientA, 'Sesión 1', 'Avance notable de Ana.', now, now, ownerA);

  // Fila "envenenada": apunta al paciente de A pero pertenece a B.
  // El retriever de A NO debe devolverla (filtro por owner en la query de notas).
  db.prepare(
    'INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), patientA, 'Nota ajena', 'CONTENIDO DE OTRO DUEÑO', now, now, ownerB);

  db.prepare(
    'INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, diagnosed_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), patientA, '6B00', 'Trastorno de ansiedad generalizada', now, ownerA);

  const agendaA = randomUUID();
  db.prepare('INSERT INTO agendas (id, name, slug, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?)').run(
    agendaA,
    'Consulta individual',
    `consulta-${randomUUID()}`,
    now,
    ownerA,
  );
  db.prepare(
    'INSERT INTO bookings (id, agenda_id, patient_id, start_at, end_at, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    randomUUID(),
    agendaA,
    patientA,
    '2030-01-15T10:00:00.000Z',
    '2030-01-15T11:00:00.000Z',
    now,
    ownerA,
  );
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

describe('PatientContextRetriever — scoping por owner_user_id', () => {
  it('listPatients solo devuelve los pacientes del dueño', async () => {
    const nombresA = (await new SqlitePatientContextRetriever(ownerA).listPatients()).map((p) => p.fullName);
    const nombresB = (await new SqlitePatientContextRetriever(ownerB).listPatients()).map((p) => p.fullName);
    expect(nombresA).toEqual(['Paciente De Ana']);
    expect(nombresB).toEqual(['Paciente De Bruno']);
  });

  it('retrieve de un paciente ajeno devuelve null aunque el id exista', async () => {
    expect(await new SqlitePatientContextRetriever(ownerB).retrieve(patientA)).toBeNull();
    expect(await new SqlitePatientContextRetriever(ownerA).retrieve(patientB)).toBeNull();
  });

  it('retrieve devuelve contexto completo del paciente propio SIN filas de otro dueño', async () => {
    const context = await new SqlitePatientContextRetriever(ownerA, getDatabaseAdapter(), consintiente).retrieve(patientA);
    expect(context).not.toBeNull();
    expect(context!.patient.fullName).toBe('Paciente De Ana');
    expect(context!.diagnoses.map((d) => d.code)).toEqual(['6B00']);
    expect(context!.upcomingBookings).toHaveLength(1);
    expect(context!.upcomingBookings[0].agendaName).toBe('Consulta individual');
    // La nota "envenenada" (patient_id de A, owner B) jamás aparece.
    expect(context!.recentNotes.map((n) => n.title)).toEqual(['Sesión 1']);
    expect(JSON.stringify(context)).not.toContain('CONTENIDO DE OTRO DUEÑO');
  });
});

describe('ChatThreadRepository — scoping por owner_user_id', () => {
  const threadId = randomUUID();

  it('un hilo guardado por A no existe para B (findById ni listSummaries)', async () => {
    const repoA = new SqliteChatThreadRepository(ownerA);
    const repoB = new SqliteChatThreadRepository(ownerB);

    await repoA.save(ChatThread.create({ id: threadId, patientId: patientA, firstQuestion: 'Notas de Ana' }));

    expect(await repoA.findById(threadId)).not.toBeNull();
    expect(await repoB.findById(threadId)).toBeNull();
    expect((await repoA.listSummaries()).map((t) => t.id)).toContain(threadId);
    expect((await repoB.listSummaries()).map((t) => t.id)).not.toContain(threadId);
  });

  it('B no puede añadir mensajes al hilo de A (insert condicionado por owner)', async () => {
    const repoA = new SqliteChatThreadRepository(ownerA);
    const repoB = new SqliteChatThreadRepository(ownerB);

    await repoB.appendMessage(
      ChatMessage.create({ id: randomUUID(), threadId, role: 'usuario', content: 'intruso' }),
    );
    expect(await repoA.listMessages(threadId)).toHaveLength(0);

    await repoA.appendMessage(
      ChatMessage.create({ id: randomUUID(), threadId, role: 'usuario', content: 'mensaje propio' }),
    );
    expect(await repoA.listMessages(threadId)).toHaveLength(1);
    // B tampoco puede LEER los mensajes del hilo de A.
    expect(await repoB.listMessages(threadId)).toHaveLength(0);
  });

  it('B no puede sobrescribir el hilo de A (upsert condicionado por owner)', async () => {
    const repoA = new SqliteChatThreadRepository(ownerA);
    const repoB = new SqliteChatThreadRepository(ownerB);

    const original = (await repoA.findById(threadId))!.toPrimitives();
    await repoB.save(ChatThread.fromPrimitives({ ...original, title: 'Hackeado' }));

    expect((await repoA.findById(threadId))!.toPrimitives().title).toBe(original.title);
    expect(await repoB.findById(threadId)).toBeNull();
  });

  it('el resumen de hilos incluye el nombre del paciente anclado (del propio dueño)', async () => {
    const summaries = await new SqliteChatThreadRepository(ownerA).listSummaries();
    const summary = summaries.find((t) => t.id === threadId);
    expect(summary?.patientName).toBe('Paciente De Ana');
  });
});
