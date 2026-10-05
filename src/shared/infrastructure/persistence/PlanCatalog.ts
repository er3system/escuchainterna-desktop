import { getDatabaseAdapter } from './SqliteAdapter';

/**
 * Lectura compartida del catálogo de planes y del costeo de IA de plataforma.
 * Devuelve SIEMPRE objetos planos (frontera servidor→cliente segura).
 */

export interface PlanInfo {
  id: string;
  name: string;
  /** Precio de lista mensual por moneda de display, p. ej. { COP: 79000, MXN: 349 }. */
  prices: Record<string, number>;
  aiMonthlyBudgetCop: number | null;
  aiSoftBudgetCop: number | null;
  features: string[];
  highlighted: boolean;
  sortOrder: number;
}

export interface AiCosting {
  copPerUsd: number;
  modeloPremium: string;
  modeloEconomico: string;
  tarifas: Record<string, { inPorMTok: number; outPorMTok: number }>;
}

interface PlanRow {
  id: string;
  name: string;
  prices_json: string;
  ai_monthly_budget_cop: number | null;
  ai_soft_budget_cop: number | null;
  features_json: string;
  highlighted: number;
  sort_order: number;
}

function hydrate(row: PlanRow): PlanInfo {
  return {
    id: row.id,
    name: row.name,
    prices: JSON.parse(row.prices_json || '{}'),
    aiMonthlyBudgetCop: row.ai_monthly_budget_cop,
    aiSoftBudgetCop: row.ai_soft_budget_cop,
    features: JSON.parse(row.features_json || '[]'),
    highlighted: row.highlighted === 1,
    sortOrder: row.sort_order,
  };
}

export async function listPlans(): Promise<PlanInfo[]> {
  const rows = await getDatabaseAdapter().query<PlanRow>('SELECT * FROM plans ORDER BY sort_order');
  return rows.map(hydrate);
}

export async function findPlan(id: string): Promise<PlanInfo | null> {
  const row = await getDatabaseAdapter().queryRow<PlanRow>('SELECT * FROM plans WHERE id = ?', [id]);
  return row ? hydrate(row) : null;
}

export async function getAiCosting(): Promise<AiCosting> {
  const row = await getDatabaseAdapter().queryRow<{ value_json: string }>(
    `SELECT value_json FROM platform_settings WHERE key = 'ai_costing'`,
  );
  const fallback: AiCosting = {
    copPerUsd: 4200,
    // Premium = Sonnet 5 (ver nota en seed.ts AI_COSTING_JSON). Precio de lista
    // 3/15 USD por MTok; el intro 2/10 no se refleja (costeo conservador).
    modeloPremium: 'claude-sonnet-5',
    modeloEconomico: 'claude-haiku-4-5',
    tarifas: {
      'claude-sonnet-5': { inPorMTok: 3, outPorMTok: 15 },
      'claude-sonnet-4-6': { inPorMTok: 3, outPorMTok: 15 },
      'claude-haiku-4-5': { inPorMTok: 1, outPorMTok: 5 },
    },
  };
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value_json) as Partial<AiCosting>;
    // Deep-merge de `tarifas`: con el spread superficial, un ai_costing VIEJO en
    // la BD (sin la tarifa de un modelo que el código llega a usar) pisaría el
    // mapa completo y recordUsage costearía $0 en silencio — socavando el tope
    // de presupuesto. Las tarifas del código quedan de respaldo por modelo y la
    // BD solo pisa las que declara explícitamente.
    return {
      ...fallback,
      ...parsed,
      tarifas: { ...fallback.tarifas, ...(parsed.tarifas ?? {}) },
    };
  } catch {
    return fallback;
  }
}
