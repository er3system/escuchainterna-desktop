import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RegisterPractitionerMessage } from '@/contexts/identity/application/register-practitioner/RegisterPractitionerMessage';
import { DESKTOP_LEGAL_VERSIONS } from '@/shared/legal/legalVersions';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-desktop-'));
let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let identity: ReturnType<typeof import('@/contexts/identity/infrastructure/createIdentityUseCases')['createIdentityUseCases']>;
let localUserId: string;

beforeAll(async () => {
  vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
  vi.stubEnv('DATABASE_PATH', path.join(temporaryDirectory, 'desktop.db'));
  vi.stubEnv('CIE11_DATASET_PATH', path.join(temporaryDirectory, 'catalog-not-installed.json'));
  // Incluso con variables SaaS heredadas, no se crea un admin en una instalación local.
  vi.stubEnv('ADMIN_BOOTSTRAP_EMAIL', 'admin@example.test');
  vi.stubEnv('ADMIN_BOOTSTRAP_PASSWORD', 'NubeSegura2026!');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  const { createIdentityUseCases } = await import('@/contexts/identity/infrastructure/createIdentityUseCases');
  identity = createIdentityUseCases();
});

afterAll(() => {
  getDb().close();
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  vi.unstubAllEnvs();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe('primera instalación de EscuchaInterna para PC', () => {
  it('migra una base vacía sin cuentas, pacientes, suscripciones ni eventos demo', () => {
    for (const table of ['users', 'patients', 'subscriptions', 'community_events']) {
      expect(getDb().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    expect(Number(getDb().prepare('SELECT COUNT(*) AS count FROM clinical_record_templates').get()!.count)).toBeGreaterThan(0);
  });

  it('registra una cuenta propia con perfil y contraseña válida, sin trial ni suscripción', async () => {
    localUserId = await identity.registerPractitioner.register(new RegisterPractitionerMessage({
      fullName: 'Ana Profesional', email: 'ana.local@example.test', password: 'NubeSegura2026!',
      phoneDialCode: '+52', phoneNumber: '', acceptedTerms: true, referralCode: 'REFERIDO',
    }));
    expect(await identity.loginUser.login('ana.local@example.test', 'NubeSegura2026!')).toMatchObject({ userId: localUserId });
    expect(await identity.getSessionContext.get(localUserId)).toMatchObject({
      role: 'psychologist', status: 'activo', dataOwnerUserId: localUserId, subscription: null,
    });
    expect(getDb().prepare('SELECT COUNT(*) AS count FROM subscriptions').get()).toEqual({ count: 0 });
    expect(getDb().prepare('SELECT COUNT(*) AS count FROM referrals').get()).toEqual({ count: 0 });
    expect(getDb().prepare('SELECT terms_version, privacy_version FROM users WHERE id = ?').get(localUserId)).toEqual({ terms_version: DESKTOP_LEGAL_VERSIONS.terms, privacy_version: DESKTOP_LEGAL_VERSIONS.privacy });
    await expect(identity.loginUser.login('ana.local@example.test', 'incorrecta')).rejects.toThrow();
  });

  it('conserva aislamiento y elimina las cuotas comerciales de archivos, IA y mensajes', async () => {
    const { resolveStorageLimitBytes } = await import('@/shared/infrastructure/storage-billing/StorageQuotaGate');
    const { resolveAiAccess } = await import('@/shared/infrastructure/ai-billing/AiBudgetGate');
    const { resolveWaBudget } = await import('@/shared/infrastructure/message-billing/WaBudgetGate');
    const now = new Date().toISOString();
    getDb().prepare(`INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, created_at) VALUES (?, ?, 'esencial', 'vencida', ?, ?)`).run(randomUUID(), localUserId, now, now);
    getDb().prepare(`INSERT INTO ai_usage_events (id, owner_user_id, kind, model, input_tokens, output_tokens, est_cost_usd, est_cost_cop, created_at) VALUES (?, ?, 'chat', 'local', 1, 1, 1, 999999, ?)`).run(randomUUID(), localUserId, now);

    expect(await resolveStorageLimitBytes(localUserId)).toBeNull();
    expect(await resolveAiAccess(localUserId, 'chat')).toMatchObject({ allowed: true, plan: 'local', monthSpentCop: 999999 });
    expect(await resolveAiAccess('otro-usuario', 'chat')).toMatchObject({ allowed: true, plan: 'local', monthSpentCop: 0 });
    expect(await resolveWaBudget(localUserId)).toMatchObject({ limit: null, exceeded: false, plan: 'local' });
  });
});
