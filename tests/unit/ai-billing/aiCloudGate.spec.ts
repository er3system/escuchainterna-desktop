import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Kill-switch global de la IA en nube: por defecto habilitado; al apagarlo, las fábricas de motores
 * caen al modo LOCAL aunque exista ANTHROPIC_API_KEY (cortar la transferencia a un tercero, Ley 1581).
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-aicloud-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let aiCloudEnabled: typeof import('@/shared/infrastructure/ai-billing/aiCloudGate')['aiCloudEnabled'];
let setAiCloudEnabled: typeof import('@/shared/infrastructure/ai-billing/aiCloudGate')['setAiCloudEnabled'];
let createAssistantEngine: typeof import('@/contexts/assistant/infrastructure/ai/createAssistantEngine')['createAssistantEngine'];

const prevApiKey = process.env.ANTHROPIC_API_KEY;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  process.env.ANTHROPIC_API_KEY = 'sk-test-key'; // simula que SÍ hay clave de nube
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ aiCloudEnabled, setAiCloudEnabled } = await import('@/shared/infrastructure/ai-billing/aiCloudGate'));
  ({ createAssistantEngine } = await import('@/contexts/assistant/infrastructure/ai/createAssistantEngine'));
  getDb(); // corre migraciones (crea platform_settings)
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  if (prevApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevApiKey;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('aiCloudGate (kill-switch global de IA en nube)', () => {
  it('por defecto está habilitado (ausencia del ajuste = nube on)', async () => {
    expect(await aiCloudEnabled()).toBe(true);
  });

  it('setAiCloudEnabled persiste el estado y aiCloudEnabled lo refleja', async () => {
    await setAiCloudEnabled(false);
    expect(await aiCloudEnabled()).toBe(false);
    await setAiCloudEnabled(true);
    expect(await aiCloudEnabled()).toBe(true);
  });

  it('con API key + nube habilitada → motor de NUBE (anthropic)', async () => {
    await setAiCloudEnabled(true);
    const engine = await createAssistantEngine('owner-1', { allowed: true, model: 'm', plan: 'profesional', monthSpentCop: 0 });
    expect(engine.providerName()).toBe('anthropic');
  });

  it('con API key pero kill-switch APAGADO → motor LOCAL (corta la transferencia a la nube)', async () => {
    await setAiCloudEnabled(false);
    const engine = await createAssistantEngine('owner-1', { allowed: true, model: 'm', plan: 'profesional', monthSpentCop: 0 });
    expect(engine.providerName()).toBe('local');
    await setAiCloudEnabled(true); // restaura para no afectar a otros casos
  });
});
