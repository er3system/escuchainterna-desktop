import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { getAiCosting } from '../persistence/PlanCatalog';
import type { AiUsageKind } from './AiBudgetGate';

/**
 * Registro de uso de IA: cada interacción inserta un evento en
 * `ai_usage_events` con el costo estimado según las tarifas vigentes
 * (USD por millón de tokens) y el tipo de cambio COP/USD del costeo de
 * plataforma. Se registra SIEMPRE — también en modo local, con los tokens
 * estimados del modelo que SE HABRÍA usado — para que el dashboard y los
 * límites de presupuesto sean realistas desde el primer día.
 */

export interface AiUsageInput {
  ownerUserId: string;
  kind: AiUsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Estimación rápida de tokens: ~4 caracteres por token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Tokens de entrada "facturables equivalentes" a partir del uso REAL de la API
 * con prompt caching. La lectura de caché cuesta ~10% del precio de entrada y
 * la escritura ~125%; convertir a un equivalente deja intacto el cálculo de
 * costo por MTok de recordUsage y hace que el ahorro de la caché se refleje en
 * el dashboard y en la puerta de presupuesto (no solo en la factura real).
 */
export function billableInputTokens(usage: {
  input_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number {
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return Math.round(usage.input_tokens + 1.25 * cacheWrite + 0.1 * cacheRead);
}

export async function recordUsage(input: AiUsageInput): Promise<void> {
  const costing = await getAiCosting();
  const tarifa = costing.tarifas[input.model] ?? { inPorMTok: 0, outPorMTok: 0 };
  const estCostUsd =
    (input.inputTokens / 1_000_000) * tarifa.inPorMTok + (input.outputTokens / 1_000_000) * tarifa.outPorMTok;
  const estCostCop = estCostUsd * costing.copPerUsd;

  await getDatabaseAdapter().execute(
    `INSERT INTO ai_usage_events
         (id, owner_user_id, kind, model, input_tokens, output_tokens, est_cost_usd, est_cost_cop, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.ownerUserId,
      input.kind,
      input.model,
      Math.max(0, Math.round(input.inputTokens)),
      Math.max(0, Math.round(input.outputTokens)),
      estCostUsd,
      estCostCop,
      new Date().toISOString(),
    ],
  );
}
