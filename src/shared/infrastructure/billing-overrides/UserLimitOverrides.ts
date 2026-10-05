import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Overrides de topes POR CUENTA (migración v27). Cuando un campo está presente
 * (no null), PISA al valor del plan en el gate correspondiente (IA, WhatsApp,
 * almacenamiento). null = usar el plan. Es el ajuste fino del admin; para dejar
 * a alguien "sin tope" se le cambia el plan, no se usa este override.
 */

export interface UserLimitOverrides {
  /** Tope DURO de IA del mes (COP). */
  aiMonthlyBudgetCop: number | null;
  /** Umbral SUAVE de IA del mes (COP) → degrada al modelo económico. */
  aiSoftBudgetCop: number | null;
  /** Tope mensual de WhatsApp. */
  waMonthlyLimit: number | null;
  /** Cuota de almacenamiento de adjuntos (GB). */
  storageLimitGb: number | null;
}

export const EMPTY_OVERRIDES: UserLimitOverrides = {
  aiMonthlyBudgetCop: null,
  aiSoftBudgetCop: null,
  waMonthlyLimit: null,
  storageLimitGb: null,
};

interface OverrideRow {
  ai_monthly_budget_cop: number | null;
  ai_soft_budget_cop: number | null;
  wa_monthly_limit: number | null;
  storage_limit_gb: number | null;
}

/** Overrides del usuario (todo null si no hay fila). */
export async function getUserLimitOverrides(userId: string): Promise<UserLimitOverrides> {
  const row = await getDatabaseAdapter().queryRow<OverrideRow>(
    `SELECT ai_monthly_budget_cop, ai_soft_budget_cop, wa_monthly_limit, storage_limit_gb
         FROM user_limit_overrides WHERE user_id = ?`,
    [userId],
  );
  if (!row) return { ...EMPTY_OVERRIDES };
  return {
    aiMonthlyBudgetCop: row.ai_monthly_budget_cop,
    aiSoftBudgetCop: row.ai_soft_budget_cop,
    waMonthlyLimit: row.wa_monthly_limit,
    storageLimitGb: row.storage_limit_gb,
  };
}

/** Upsert de los overrides (cada campo null = quitar el override y volver al plan). */
export async function setUserLimitOverrides(userId: string, overrides: UserLimitOverrides): Promise<void> {
  await getDatabaseAdapter().execute(
    `INSERT INTO user_limit_overrides
         (user_id, ai_monthly_budget_cop, ai_soft_budget_cop, wa_monthly_limit, storage_limit_gb)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         ai_monthly_budget_cop = excluded.ai_monthly_budget_cop,
         ai_soft_budget_cop = excluded.ai_soft_budget_cop,
         wa_monthly_limit = excluded.wa_monthly_limit,
         storage_limit_gb = excluded.storage_limit_gb`,
    [
      userId,
      overrides.aiMonthlyBudgetCop,
      overrides.aiSoftBudgetCop,
      overrides.waMonthlyLimit,
      overrides.storageLimitGb,
    ],
  );
}
