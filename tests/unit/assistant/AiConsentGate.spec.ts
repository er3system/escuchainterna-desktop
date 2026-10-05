import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CONSENT_BODY, AI_CONSENT_MARKER } from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';

/**
 * AiConsentGate (Ley 1581): el asistente solo recibe el contexto de un paciente si su consentimiento
 * está OTORGADO, vigente y con la cláusula de finalidad-IA (fail-closed). La revocación corta el canal.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-aiconsent-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let getDatabaseAdapter: typeof import('@/shared/infrastructure/persistence/SqliteAdapter')['getDatabaseAdapter'];
let SqliteAiConsentGate: typeof import('@/contexts/assistant/infrastructure/persistence/SqliteAiConsentGate')['SqliteAiConsentGate'];
let SqlitePatientContextRetriever: typeof import('@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever')['SqlitePatientContextRetriever'];

const owner = `owner-${randomUUID()}`;
const otroOwner = `otro-${randomUUID()}`;
const patientId = randomUUID();
const now = new Date().toISOString();

function seedConsent(p: {
  patient?: string;
  ownerId?: string;
  status?: string;
  aiAuthorized?: 0 | 1;
  revokedAt?: string | null;
  createdAt?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO patient_consents
         (id, patient_id, owner_user_id, token, template_title, template_body, status,
          sent_at, signed_at, signed_name, signature_kind, file_path, created_at, revoked_at, ai_authorized)
       VALUES (?, ?, ?, ?, 'T', 'B', ?, ?, ?, '', '', NULL, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      p.patient ?? patientId,
      p.ownerId ?? owner,
      randomUUID(),
      p.status ?? 'firmado',
      now,
      now,
      p.createdAt ?? now,
      p.revokedAt ?? null,
      p.aiAuthorized ?? 1,
    );
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ getDatabaseAdapter } = await import('@/shared/infrastructure/persistence/SqliteAdapter'));
  ({ SqliteAiConsentGate } = await import('@/contexts/assistant/infrastructure/persistence/SqliteAiConsentGate'));
  ({ SqlitePatientContextRetriever } = await import(
    '@/contexts/assistant/infrastructure/persistence/SqlitePatientContextRetriever'
  ));

  getDb()
    .prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'Paciente', ?, ?)`)
    .run(patientId, now, owner);
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

describe('SqliteAiConsentGate', () => {
  it('el cuerpo de consentimiento POR DEFECTO incluye la cláusula que autoriza IA', () => {
    expect(DEFAULT_CONSENT_BODY.toLowerCase()).toContain(AI_CONSENT_MARKER);
  });

  it('una cláusula que solo MENCIONA (o niega) la IA NO activa el marcador (regresión)', () => {
    // Con el marcador viejo ('inteligencia artificial' a secas), esta plantilla
    // editada activaba ai_authorized=1 — lo contrario de lo firmado.
    const negativa =
      'Tratamiento de datos: NO autorizo que mi información sea tratada por herramientas de inteligencia artificial.';
    expect(negativa.toLowerCase().includes(AI_CONSENT_MARKER)).toBe(false);
    const mencion = 'El consultorio utiliza software moderno, incluida inteligencia artificial, en su operación.';
    expect(mencion.toLowerCase().includes(AI_CONSENT_MARKER)).toBe(false);
  });

  it('fail-closed: sin ningún consentimiento, NO autoriza', async () => {
    const gate = new SqliteAiConsentGate(owner);
    expect(await gate.isAuthorized(patientId)).toBe(false);
  });

  it('consentimiento firmado, vigente y con finalidad-IA → autoriza', async () => {
    seedConsent({ status: 'firmado', aiAuthorized: 1, revokedAt: null });
    expect(await new SqliteAiConsentGate(owner).isAuthorized(patientId)).toBe(true);
  });

  it('la REVOCACIÓN corta el canal IA (revoked_at del último consentimiento)', async () => {
    // El consentimiento más reciente está revocado → no autoriza, aunque tenga ai_authorized=1.
    seedConsent({ status: 'revocado', aiAuthorized: 1, revokedAt: now, createdAt: new Date(Date.now() + 1000).toISOString() });
    expect(await new SqliteAiConsentGate(owner).isAuthorized(patientId)).toBe(false);
  });

  it('un consentimiento SIN finalidad-IA (ai_authorized=0) no autoriza', async () => {
    const p = randomUUID();
    getDb().prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'P2', ?, ?)`).run(p, now, owner);
    seedConsent({ patient: p, status: 'firmado', aiAuthorized: 0 });
    expect(await new SqliteAiConsentGate(owner).isAuthorized(p)).toBe(false);
  });

  it('un consentimiento PENDIENTE (no otorgado) con finalidad-IA no autoriza', async () => {
    const p = randomUUID();
    getDb().prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'P3', ?, ?)`).run(p, now, owner);
    seedConsent({ patient: p, status: 'pendiente', aiAuthorized: 1 });
    expect(await new SqliteAiConsentGate(owner).isAuthorized(p)).toBe(false);
  });

  it('owner-scoped: el consentimiento de OTRO dueño no autoriza al dueño en sesión', async () => {
    const p = randomUUID();
    getDb().prepare(`INSERT INTO patients (id, full_name, created_at, owner_user_id) VALUES (?, 'P4', ?, ?)`).run(p, now, otroOwner);
    seedConsent({ patient: p, ownerId: otroOwner, status: 'firmado', aiAuthorized: 1 });
    // El gate del dueño en sesión (owner) no ve el consentimiento de otroOwner.
    expect(await new SqliteAiConsentGate(owner).isAuthorized(p)).toBe(false);
  });
});

describe('SqlitePatientContextRetriever · gate de consentimiento', () => {
  it('si el gate NIEGA, retrieve devuelve null aunque el paciente exista (cero dato al LLM)', async () => {
    const retriever = new SqlitePatientContextRetriever(owner, getDatabaseAdapter(), { isAuthorized: async () => false });
    expect(await retriever.retrieve(patientId)).toBe(null);
  });
});
