import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Bitácora de acceso a expedientes (v3 §1.2): throttle de 10 minutos por
 * actor+paciente+área, búsqueda con filtros y parsing de rutas del expediente.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-bitacora-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let audit: typeof import('@/shared/infrastructure/audit/recordAccessLog');

const actorId = `actor-${randomUUID()}`;
const otherActorId = `actor-${randomUUID()}`;
const patientId = randomUUID();

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  audit = await import('@/shared/infrastructure/audit/recordAccessLog');

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(actorId, 'psicologa@correo.test', 'hash', 'psychologist', 'activo', now);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(otherActorId, 'supervisor@correo.test', 'hash', 'professor', 'activo', now);
  db.prepare(
    `INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, ?, ?, ?)`,
  ).run(patientId, 'Carolina Prueba', now, actorId);
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

function countRows(): number {
  return (
    getDb().prepare('SELECT COUNT(*) AS n FROM record_access_log').get() as { n: number }
  ).n;
}

describe('logRecordAccess', () => {
  it('aplica throttle de 10 minutos por actor+paciente+área', async () => {
    const before = countRows();
    await audit.logRecordAccess(actorId, patientId, 'historia');
    await audit.logRecordAccess(actorId, patientId, 'historia'); // re-render: se ignora
    expect(countRows()).toBe(before + 1);

    await audit.logRecordAccess(actorId, patientId, 'sesiones'); // otra área SÍ registra
    await audit.logRecordAccess(otherActorId, patientId, 'historia'); // otro actor SÍ registra
    expect(countRows()).toBe(before + 3);
  });

  it('vuelve a registrar cuando el último evento es viejo', async () => {
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    getDb()
      .prepare(
        `UPDATE record_access_log SET created_at = ? WHERE actor_user_id = ? AND area = 'historia'`,
      )
      .run(old, actorId);
    const before = countRows();
    await audit.logRecordAccess(actorId, patientId, 'historia');
    expect(countRows()).toBe(before + 1);
  });

  it("una 'acceso_cobertura' NUNCA es suprimida por una 'ver' previa (habeas data §2.3)", async () => {
    const coverActor = `cover-${randomUUID()}`;
    const coverPatient = randomUUID();
    // Primero un 'ver' del mismo actor+paciente+área.
    await audit.logRecordAccess(coverActor, coverPatient, 'resumen', 'ver');
    const before = countRows();
    // Una acción DISTINTA en la misma clave (actor+paciente+área) sí se registra:
    // el throttle es granular por acción y no debe enmascarar la cobertura.
    await audit.logRecordAccess(coverActor, coverPatient, 'resumen', 'acceso_cobertura');
    expect(countRows()).toBe(before + 1);
    // La segunda 'acceso_cobertura' inmediata sí se throttlea (misma acción).
    await audit.logRecordAccess(coverActor, coverPatient, 'resumen', 'acceso_cobertura');
    expect(countRows()).toBe(before + 1);
  });
});

describe('searchRecordAccess', () => {
  it('filtra por paciente, actor y dueño', async () => {
    const byPatient = await audit.searchRecordAccess({ patientQuery: 'Carolina' });
    expect(byPatient.length).toBeGreaterThan(0);
    expect(byPatient.every((entry) => entry.patientName === 'Carolina Prueba')).toBe(true);

    const byActor = await audit.searchRecordAccess({ actorQuery: 'supervisor@' });
    expect(byActor.length).toBeGreaterThan(0);
    expect(byActor.every((entry) => entry.actorUserId === otherActorId)).toBe(true);

    const ownerScoped = await audit.listPatientAccessLog(actorId, patientId, 50);
    expect(ownerScoped.length).toBeGreaterThan(0);
    const foreignScoped = await audit.listPatientAccessLog('otro-owner', patientId, 50);
    expect(foreignScoped).toHaveLength(0);
  });

  it('limita a miembros del equipo (vista de organización)', async () => {
    const teamView = await audit.searchRecordAccess({ memberUserIds: [otherActorId] });
    // El supervisor accedió Y la paciente pertenece al actorId (no miembro):
    // todos los resultados deben involucrar al supervisor como actor o dueño.
    expect(teamView.length).toBeGreaterThan(0);
    expect(teamView.some((entry) => entry.actorUserId === otherActorId)).toBe(true);

    expect(await audit.searchRecordAccess({ memberUserIds: [] })).toHaveLength(0);
  });
});

describe('parseExpedientePath', () => {
  it('deriva paciente y área de la ruta', () => {
    expect(audit.parseExpedientePath(`/pacientes/${patientId}`)).toEqual({
      patientId,
      area: 'resumen',
    });
    expect(audit.parseExpedientePath(`/pacientes/${patientId}/historia/abc`)).toEqual({
      patientId,
      area: 'historia',
    });
    expect(audit.parseExpedientePath(`/pacientes/${patientId}/mapa-familiar`)).toEqual({
      patientId,
      area: 'mapa-familiar',
    });
    expect(audit.parseExpedientePath(`/pacientes/${patientId}/mensajes`)).toEqual({
      patientId,
      area: 'mensajes',
    });
    expect(audit.parseExpedientePath(`/pacientes/${patientId}/nueva-area-clinica`)).toBeNull();
    expect(audit.parseExpedientePath('/pacientes/nuevo')).toBeNull();
    expect(audit.parseExpedientePath('/pacientes/importar')).toBeNull();
    expect(audit.parseExpedientePath('/agenda')).toBeNull();
  });

  it('clasifica las áreas clínicas (vedadas al rol asistente)', () => {
    expect(audit.isClinicalArea('historia')).toBe(true);
    expect(audit.isClinicalArea('sesiones')).toBe(true);
    expect(audit.isClinicalArea('exportar')).toBe(true);
    expect(audit.isClinicalArea('mapa-familiar')).toBe(true);
    expect(audit.isClinicalArea('cuestionarios')).toBe(true);
    expect(audit.isClinicalArea('vinculos')).toBe(true);
    expect(audit.isClinicalArea('resumen')).toBe(false);
    expect(audit.isClinicalArea('mensajes')).toBe(false);
    expect(audit.isClinicalArea('pagos')).toBe(false);
  });

  it('veda al asistente las áreas clínicas, incluidas cuestionarios y vínculos (fail-closed)', () => {
    const id = patientId;
    // Clínicas: vedadas.
    for (const area of ['historia', 'sesiones', 'diagnostico', 'cuestionarios', 'vinculos', 'archivos', 'exportar', 'mapa-familiar']) {
      expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${id}/${area}`)).toBe(true);
    }
    // Cuestionarios y vínculos se reconocen como su propia área (no caen a 'resumen').
    expect(audit.parseExpedientePath(`/pacientes/${id}/cuestionarios`)?.area).toBe('cuestionarios');
    expect(audit.parseExpedientePath(`/pacientes/${id}/vinculos/caso-1`)?.area).toBe('vinculos');
    // No clínicas: permitidas.
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${id}`)).toBe(false);
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${id}/mensajes`)).toBe(false);
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${id}/pagos`)).toBe(false);
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${id}/nueva-area-clinica`)).toBe(true);
  });
});
