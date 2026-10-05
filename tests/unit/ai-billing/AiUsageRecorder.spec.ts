import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Registro de uso de IA contra SQLite real (BD temporal): el costo estimado
 * de cada evento debe salir de las tarifas USD/MTok del costeo de plataforma
 * y convertirse a COP con el tipo de cambio configurado.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-ai-recorder-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let recordUsage: typeof import('@/shared/infrastructure/ai-billing/AiUsageRecorder')['recordUsage'];
let estimateTokens: typeof import('@/shared/infrastructure/ai-billing/AiUsageRecorder')['estimateTokens'];
let billableInputTokens: typeof import('@/shared/infrastructure/ai-billing/AiUsageRecorder')['billableInputTokens'];
let getAiCosting: typeof import('@/shared/infrastructure/persistence/PlanCatalog')['getAiCosting'];
let MeteredAssistantEngine: typeof import('@/contexts/assistant/infrastructure/ai/MeteredAssistantEngine')['MeteredAssistantEngine'];

interface EventRow {
  owner_user_id: string;
  kind: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
  est_cost_cop: number;
  created_at: string;
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ recordUsage, estimateTokens, billableInputTokens } = await import(
    '@/shared/infrastructure/ai-billing/AiUsageRecorder'
  ));
  ({ getAiCosting } = await import('@/shared/infrastructure/persistence/PlanCatalog'));
  ({ MeteredAssistantEngine } = await import('@/contexts/assistant/infrastructure/ai/MeteredAssistantEngine'));
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

function eventosDe(ownerUserId: string): EventRow[] {
  return getDb()
    .prepare(`SELECT * FROM ai_usage_events WHERE owner_user_id = ? ORDER BY created_at`)
    .all(ownerUserId) as unknown as EventRow[];
}

describe('estimateTokens', () => {
  it('estima ~4 caracteres por token, redondeando hacia arriba', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(4000))).toBe(1000);
  });
});

describe('billableInputTokens', () => {
  it('sin caché devuelve los tokens de entrada tal cual', () => {
    expect(billableInputTokens({ input_tokens: 1000 })).toBe(1000);
    expect(
      billableInputTokens({ input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }),
    ).toBe(1000);
    expect(
      billableInputTokens({ input_tokens: 1000, cache_creation_input_tokens: null, cache_read_input_tokens: null }),
    ).toBe(1000);
  });

  it('cobra la lectura de caché a ~10% (el ahorro real de la caché)', () => {
    // 200 sin cachear + 10.000 leídos de caché ⇒ 200 + 1000 = 1200 equivalentes.
    expect(
      billableInputTokens({ input_tokens: 200, cache_read_input_tokens: 10_000 }),
    ).toBe(1200);
  });

  it('cobra la escritura de caché a ~125% (la prima de primera vez)', () => {
    // 200 sin cachear + 10.000 escritos ⇒ 200 + 12.500 = 12.700 equivalentes.
    expect(
      billableInputTokens({ input_tokens: 200, cache_creation_input_tokens: 10_000 }),
    ).toBe(12_700);
  });

  it('una segunda pregunta cacheada cuesta muchísimo menos que la primera', () => {
    // 1ª llamada: escribe 8.000 al caché (prima) + 100 de pregunta.
    const primera = billableInputTokens({ input_tokens: 100, cache_creation_input_tokens: 8_000 });
    // 2ª llamada (≤5 min): lee 8.000 del caché (10%) + 120 de pregunta nueva.
    const segunda = billableInputTokens({ input_tokens: 120, cache_read_input_tokens: 8_000 });
    expect(primera).toBe(10_100);
    expect(segunda).toBe(920);
    expect(segunda).toBeLessThan(primera / 5);
  });
});

describe('recordUsage', () => {
  it('registra el costo correcto con las tarifas del modelo económico', async () => {
    const costing = await getAiCosting();
    const tarifa = costing.tarifas[costing.modeloEconomico];
    const ownerUserId = `owner-${randomUUID()}`;

    await recordUsage({
      ownerUserId,
      kind: 'pregunta_nota',
      model: costing.modeloEconomico,
      inputTokens: 200_000,
      outputTokens: 100_000,
    });

    const expectedUsd = 0.2 * tarifa.inPorMTok + 0.1 * tarifa.outPorMTok;
    const eventos = eventosDe(ownerUserId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].kind).toBe('pregunta_nota');
    expect(eventos[0].model).toBe(costing.modeloEconomico);
    expect(eventos[0].input_tokens).toBe(200_000);
    expect(eventos[0].output_tokens).toBe(100_000);
    expect(eventos[0].est_cost_usd).toBeCloseTo(expectedUsd, 10);
    expect(eventos[0].est_cost_cop).toBeCloseTo(expectedUsd * costing.copPerUsd, 6);
  });

  it('usa la tarifa del modelo premium cuando se registra ese modelo', async () => {
    const costing = await getAiCosting();
    const tarifa = costing.tarifas[costing.modeloPremium];
    const ownerUserId = `owner-${randomUUID()}`;

    await recordUsage({
      ownerUserId,
      kind: 'chat',
      model: costing.modeloPremium,
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });

    const expectedUsd = 1 * tarifa.inPorMTok + 0.5 * tarifa.outPorMTok;
    const eventos = eventosDe(ownerUserId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].est_cost_usd).toBeCloseTo(expectedUsd, 10);
    expect(eventos[0].est_cost_cop).toBeCloseTo(expectedUsd * costing.copPerUsd, 6);
  });

  it('con las tarifas del seed: 200k entrada + 100k salida en haiku ≈ 0.7 USD ≈ 2940 COP', async () => {
    // Tarifas conocidas del seed: haiku 1/5 USD por MTok, 4200 COP/USD.
    const ownerUserId = `owner-${randomUUID()}`;
    await recordUsage({
      ownerUserId,
      kind: 'reporte_sesion',
      model: 'claude-haiku-4-5',
      inputTokens: 200_000,
      outputTokens: 100_000,
    });

    const eventos = eventosDe(ownerUserId);
    expect(eventos[0].est_cost_usd).toBeCloseTo(0.7, 10);
    expect(eventos[0].est_cost_cop).toBeCloseTo(2940, 6);
  });
});

describe('MeteredAssistantEngine — uso real vs estimación', () => {
  it('mide con el uso REAL (lastUsage) cuando el adaptador lo expone (ruta Anthropic)', async () => {
    const costing = await getAiCosting();
    const ownerUserId = `owner-${randomUUID()}`;
    const fakeRemoto = {
      classifyScope: () => ({ allowed: true }) as never,
      answer: async () => 'respuesta',
      providerName: () => 'anthropic' as const,
      lastUsage: () => ({ inputTokens: 4321, outputTokens: 99 }),
    };
    const engine = new MeteredAssistantEngine(fakeRemoto as never, ownerUserId, {
      premium: costing.modeloPremium,
      economico: costing.modeloEconomico,
      riesgo: costing.modeloPremium,
    });
    // Pregunta larga: si midiera por estimación daría muchísimos más tokens.
    await engine.answer('pregunta '.repeat(200), null);

    const eventos = eventosDe(ownerUserId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].input_tokens).toBe(4321);
    expect(eventos[0].output_tokens).toBe(99);
  });

  it('estima por longitud cuando el adaptador no expone uso (modo local)', async () => {
    const costing = await getAiCosting();
    const ownerUserId = `owner-${randomUUID()}`;
    const respuesta = 'respuesta local';
    const fakeLocal = {
      classifyScope: () => ({ allowed: true }) as never,
      answer: async () => respuesta,
      providerName: () => 'local' as const,
      // sin lastUsage: el wrapper cae a la estimación por longitud.
    };
    const engine = new MeteredAssistantEngine(fakeLocal as never, ownerUserId, {
      premium: costing.modeloPremium,
      economico: costing.modeloEconomico,
      riesgo: costing.modeloPremium,
    });
    await engine.answer('hola', null);

    const eventos = eventosDe(ownerUserId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].output_tokens).toBe(estimateTokens(respuesta));
  });

  it('stream ABORTADO a mitad (cliente desconectado): el uso emitido queda registrado igual', async () => {
    const costing = await getAiCosting();
    const ownerUserId = `owner-${randomUUID()}`;
    const fakeStreaming = {
      classifyScope: () => 'permitido' as const,
      answer: async () => 'no usado',
      // Motor que emitiría 3 deltas; el consumidor corta tras el primero.
      answerStream: async function* () {
        yield 'primera parte de la respuesta ';
        yield 'segunda parte ';
        yield 'tercera parte';
      },
      providerName: () => 'local' as const,
    };
    const engine = new MeteredAssistantEngine(fakeStreaming as never, ownerUserId, {
      premium: costing.modeloPremium,
      economico: costing.modeloEconomico,
      riesgo: costing.modeloPremium,
    });

    const gen = engine.answerStream('pregunta sobre mi consulta', null);
    await gen.next(); // primer delta consumido…
    await gen.return(undefined); // …y el cliente desconecta (return() del iterador)

    // Sin el finally de medición esto era 0 filas → bypass del tope de presupuesto.
    const eventos = eventosDe(ownerUserId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].output_tokens).toBeGreaterThan(0);
  });
});
