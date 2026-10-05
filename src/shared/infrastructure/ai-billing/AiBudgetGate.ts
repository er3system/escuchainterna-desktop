import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { findPlan, getAiCosting } from '../persistence/PlanCatalog';
import { getUserLimitOverrides } from '../billing-overrides/UserLimitOverrides';
import { isDesktopEdition } from '../config/desktopEdition';

/**
 * Puerta de presupuesto de IA por plan. Decide, ANTES de invocar cualquier
 * motor de IA, si la función está permitida y el modelo con que debe servirse
 * — para 'chat', ese modelo es el TECHO por plan: el ruteo por intención
 * (intentRouter.ts) elige por pregunta entre este techo y el económico:
 *
 * - Plan con tope DURO (`ai_monthly_budget_cop`, p. ej. Esencial): siempre el
 *   modelo económico; al alcanzar el tope en el mes calendario la función se
 *   bloquea con un mensaje amable y vuelve sola el mes siguiente.
 * - Plan con umbral SUAVE (`ai_soft_budget_cop`, p. ej. Profesional u
 *   Organizaciones): sin bloqueo; al superar el umbral se degrada en silencio
 *   al modelo económico, bajo el umbral se sirve el premium.
 * - Administradores: siempre premium, sin límites.
 * - Usuarios sin suscripción propia (miembros cubiertos por su organización):
 *   se tratan como plan `profesional`.
 *
 * El gasto del mes es la suma de `est_cost_cop` en `ai_usage_events`, que se
 * registra SIEMPRE (también en modo local con tokens estimados), de modo que
 * los límites son realistas desde el primer día.
 *
 * Ruteo por TAREA (v3-spec §5): las funciones de mayor sensibilidad clínica
 * (`sugerencias_historia` y `borrador_reporte`) usan SIEMPRE el modelo premium
 * — también en Esencial, consumiendo su presupuesto (el tope duro sigue
 * bloqueando al agotarse) y también sobre el umbral suave de Profesional. El
 * resto de kinds (`chat`, `pregunta_nota`, `reporte_sesion`) sigue la regla
 * por plan.
 */

export type AiUsageKind =
  | 'chat'
  | 'pregunta_nota'
  | 'reporte_sesion'
  | 'sugerencias_historia'
  | 'borrador_reporte'
  // Resumen de caso para supervisión académica (v3.2): el gasto se registra
  // al SUPERVISOR y sigue la regla de modelo por plan (no premium-siempre).
  | 'resumen_supervision'
  // Pulir el texto de una nota de sesión (borrador editable): conveniencia de
  // redacción, sigue la regla de modelo por plan (no premium-siempre).
  | 'pulir_nota';

export interface AiAccess {
  allowed: boolean;
  /**
   * TECHO de modelo por plan (o el que SE HABRÍA usado, para medición en modo
   * local). Para 'chat' NO es directamente "el modelo a usar": el ruteo por
   * intención elige por pregunta entre este techo y el económico (ver
   * intentRouter.ts). El resto de kinds lo usa tal cual.
   */
  model: string;
  blockedMessage?: string;
  plan: string;
  monthSpentCop: number;
}

export const AI_BUDGET_BLOCKED_MESSAGE =
  'Alcanzaste el límite de IA de tu plan este mes. Mejora a Profesional para IA sin límites.';

/** Kinds que se sirven SIEMPRE con el modelo premium, sin importar el plan. */
export const PREMIUM_ALWAYS_KINDS: ReadonlySet<AiUsageKind> = new Set([
  'sugerencias_historia',
  'borrador_reporte',
]);

/** Rango [inicio, fin) del mes calendario (UTC, como los `created_at` ISO). */
function monthRange(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { start, end };
}

/** Gasto estimado (COP) del dueño en el mes calendario en curso. */
export async function sumMonthSpentCop(ownerUserId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = monthRange(now);
  const row = await getDatabaseAdapter().queryRow<{ total: number }>(
    `SELECT COALESCE(SUM(est_cost_cop), 0) AS total
         FROM ai_usage_events
        WHERE owner_user_id = ? AND created_at >= ? AND created_at < ?`,
    [ownerUserId, start, end],
  );
  return row ? Number(row.total) : 0;
}

/**
 * Resuelve el acceso a IA del dueño para una función concreta. El `kind`
 * decide el ruteo de modelo: los de `PREMIUM_ALWAYS_KINDS` van siempre al
 * premium (en cualquier plan); el resto sigue la regla por plan.
 */
export async function resolveAiAccess(ownerUserId: string, kind: AiUsageKind): Promise<AiAccess> {
  const alwaysPremium = PREMIUM_ALWAYS_KINDS.has(kind);
  const costing = await getAiCosting();
  const monthSpentCop = await sumMonthSpentCop(ownerUserId);

  if (isDesktopEdition()) {
    return { allowed: true, model: costing.modeloPremium, plan: 'local', monthSpentCop };
  }

  const db = getDatabaseAdapter();
  const user = await db.queryRow<{ role: string }>('SELECT role FROM users WHERE id = ?', [ownerUserId]);
  if (user && user.role === 'admin') {
    return { allowed: true, model: costing.modeloPremium, plan: 'admin', monthSpentCop };
  }

  const subscription = await db.queryRow<{ plan: string }>(
    'SELECT plan FROM subscriptions WHERE user_id = ?',
    [ownerUserId],
  );
  // Sin suscripción propia = miembro cubierto por su organización → profesional.
  const planId = subscription ? subscription.plan : 'profesional';
  const plan = (await findPlan(planId)) ?? (await findPlan('profesional'));

  // Override por cuenta (v27): si está presente, pisa al tope del plan.
  const override = await getUserLimitOverrides(ownerUserId);
  const hardCapCop = override.aiMonthlyBudgetCop ?? plan?.aiMonthlyBudgetCop ?? null;
  if (hardCapCop !== null) {
    // Plan con tope duro (Esencial): modelo económico, salvo los kinds
    // premium-siempre, que van al premium consumiendo el mismo presupuesto.
    const cappedModel = alwaysPremium ? costing.modeloPremium : costing.modeloEconomico;
    if (monthSpentCop >= hardCapCop) {
      return {
        allowed: false,
        model: cappedModel,
        blockedMessage: AI_BUDGET_BLOCKED_MESSAGE,
        plan: planId,
        monthSpentCop,
      };
    }
    return { allowed: true, model: cappedModel, plan: planId, monthSpentCop };
  }

  // Sin tope duro: degradación SILENCIOSA al económico al superar el umbral
  // suave — excepto los kinds premium-siempre, que no se degradan.
  const softCapCop = override.aiSoftBudgetCop ?? plan?.aiSoftBudgetCop ?? null;
  const model =
    !alwaysPremium && softCapCop !== null && monthSpentCop >= softCapCop
      ? costing.modeloEconomico
      : costing.modeloPremium;
  return { allowed: true, model, plan: planId, monthSpentCop };
}
