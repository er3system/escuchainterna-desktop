import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreateAssistantMessage } from '@/contexts/identity/application/create-assistant/CreateAssistantMessage';
import { AssistantCreationNotAllowedError } from '@/contexts/identity/application/create-assistant/AssistantCreationNotAllowedError';
import { SetAssistantActiveStatusMessage } from '@/contexts/identity/application/set-assistant-active-status/SetAssistantActiveStatusMessage';
import { AssistantNotOwnedError } from '@/contexts/identity/application/set-assistant-active-status/AssistantNotOwnedError';
import { EmailAlreadyRegisteredError } from '@/contexts/identity/domain/errors/EmailAlreadyRegisteredError';

/**
 * Rol asistente/recepcionista (v3 §4): alta con suscripción cubierta,
 * resolución del dueño de datos (asistente→titular, normal→él mismo),
 * desactivación solo por su titular y guard del expediente clínico.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-asistentes-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let dataOwner: typeof import('@/shared/infrastructure/auth/dataOwner');
let audit: typeof import('@/shared/infrastructure/audit/recordAccessLog');
let identity: ReturnType<
  typeof import('@/contexts/identity/infrastructure/createIdentityUseCases')['createIdentityUseCases']
>;

const titularA = `titular-a-${randomUUID()}`;
const titularB = `titular-b-${randomUUID()}`;
const profesor = `profesor-${randomUUID()}`;
let assistantUserId = '';

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  dataOwner = await import('@/shared/infrastructure/auth/dataOwner');
  audit = await import('@/shared/infrastructure/audit/recordAccessLog');
  const { createIdentityUseCases } = await import(
    '@/contexts/identity/infrastructure/createIdentityUseCases'
  );
  identity = createIdentityUseCases();

  const db = getDb();
  const now = new Date().toISOString();
  for (const [id, email] of [
    [titularA, 'titular.a@correo.test'],
    [titularB, 'titular.b@correo.test'],
  ] as const) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, 'psychologist', 'activo', ?)`,
    ).run(id, email, 'hash', now);
  }
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, 'professor', 'activo', ?)`,
  ).run(profesor, 'profe@correo.test', 'hash', now);
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

describe('CreateAssistant', () => {
  it('crea cuenta assistant con suscripción activa cubierta y vínculo al titular', async () => {
    const created = await identity.createAssistant.create(
      new CreateAssistantMessage({
        ownerUserId: titularA,
        fullName: 'Rocío Recepción',
        email: 'rocio@consulta.test',
      }),
    );
    assistantUserId = created.userId;
    expect(created.temporaryPassword).toHaveLength(12);

    const db = getDb();
    const user = db
      .prepare('SELECT role, status, created_by FROM users WHERE id = ?')
      .get(assistantUserId) as { role: string; status: string; created_by: string };
    expect(user.role).toBe('assistant');
    expect(user.status).toBe('activo');
    expect(user.created_by).toBe(titularA);

    // Suscripción cubierta: nunca cae en el paywall.
    const subscription = db
      .prepare('SELECT status FROM subscriptions WHERE user_id = ?')
      .get(assistantUserId) as { status: string };
    expect(subscription.status).toBe('activa');

    const link = db
      .prepare('SELECT owner_user_id FROM assistants WHERE assistant_user_id = ?')
      .get(assistantUserId) as { owner_user_id: string };
    expect(link.owner_user_id).toBe(titularA);
  });

  it('rechaza correos ya registrados', async () => {
    await expect(
      identity.createAssistant.create(
        new CreateAssistantMessage({
          ownerUserId: titularA,
          fullName: 'Duplicada',
          email: 'rocio@consulta.test',
        }),
      ),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it('un asistente no puede crear otros asistentes', async () => {
    await expect(
      identity.createAssistant.create(
        new CreateAssistantMessage({
          ownerUserId: assistantUserId,
          fullName: 'Meta Asistente',
          email: 'meta@consulta.test',
        }),
      ),
    ).rejects.toThrow(AssistantCreationNotAllowedError);
  });
});

describe('resolveDataOwnerUserId (helper de dueño de datos)', () => {
  it('asistente → id del titular', async () => {
    expect(await dataOwner.resolveDataOwnerUserId(assistantUserId)).toBe(titularA);
  });

  it('usuario normal → su propio id', async () => {
    expect(await dataOwner.resolveDataOwnerUserId(titularA)).toBe(titularA);
    expect(await dataOwner.resolveDataOwnerUserId('id-inexistente')).toBe('id-inexistente');
  });

  it('isAssistantUser distingue el rol', async () => {
    expect(await dataOwner.isAssistantUser(assistantUserId)).toBe(true);
    expect(await dataOwner.isAssistantUser(titularA)).toBe(false);
  });

  it('isProfessorUser distingue el rol (gate de pantallas de consulta)', async () => {
    expect(await dataOwner.isProfessorUser(profesor)).toBe(true);
    expect(await dataOwner.isProfessorUser(titularA)).toBe(false);
    expect(await dataOwner.isProfessorUser(assistantUserId)).toBe(false);
  });
});

describe('GetSessionContext con rol asistente', () => {
  it('expone isAssistant y dataOwnerUserId del titular', async () => {
    const context = await identity.getSessionContext.get(assistantUserId);
    expect(context?.role).toBe('assistant');
    expect(context?.isAssistant).toBe(true);
    expect(context?.dataOwnerUserId).toBe(titularA);
  });

  it('para el titular, dataOwnerUserId es él mismo', async () => {
    const context = await identity.getSessionContext.get(titularA);
    expect(context?.isAssistant).toBe(false);
    expect(context?.dataOwnerUserId).toBe(titularA);
  });
});

describe('SetAssistantActiveStatus', () => {
  it('solo su titular puede desactivarlo', async () => {
    await expect(
      identity.setAssistantActiveStatus.set(
        new SetAssistantActiveStatusMessage({
          actorUserId: titularB,
          assistantUserId,
          active: false,
        }),
      ),
    ).rejects.toThrow(AssistantNotOwnedError);
  });

  it('desactivar suspende la cuenta y reactivar la restaura', async () => {
    await identity.setAssistantActiveStatus.set(
      new SetAssistantActiveStatusMessage({ actorUserId: titularA, assistantUserId, active: false }),
    );
    let status = (
      getDb().prepare('SELECT status FROM users WHERE id = ?').get(assistantUserId) as {
        status: string;
      }
    ).status;
    expect(status).toBe('suspendido');

    await identity.setAssistantActiveStatus.set(
      new SetAssistantActiveStatusMessage({ actorUserId: titularA, assistantUserId, active: true }),
    );
    status = (
      getDb().prepare('SELECT status FROM users WHERE id = ?').get(assistantUserId) as {
        status: string;
      }
    ).status;
    expect(status).toBe('activo');
  });
});

describe('Guard del expediente (rutas vedadas al asistente)', () => {
  it('las áreas clínicas quedan vedadas', () => {
    const patientId = randomUUID();
    for (const area of ['historia', 'sesiones', 'diagnostico', 'archivos', 'exportar', 'mapa-familiar']) {
      expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${patientId}/${area}`)).toBe(true);
    }
  });

  it('resumen y pagos siguen disponibles', () => {
    const patientId = randomUUID();
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${patientId}`)).toBe(false);
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${patientId}/mensajes`)).toBe(false);
    expect(audit.isExpedientePathForbiddenForAssistant(`/pacientes/${patientId}/pagos`)).toBe(false);
  });

  it('falla cerrado con rutas no interpretables', () => {
    expect(audit.isExpedientePathForbiddenForAssistant('/agenda')).toBe(true);
    expect(audit.isExpedientePathForbiddenForAssistant('')).toBe(true);
    expect(
      audit.isExpedientePathForbiddenForAssistant(`/pacientes/${randomUUID()}/nueva-area-clinica`),
    ).toBe(true);
  });
});
