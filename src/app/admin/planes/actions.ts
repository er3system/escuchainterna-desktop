'use server';

import { revalidatePath } from 'next/cache';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { findPlan } from '@/shared/infrastructure/persistence/PlanCatalog';
import { DEFAULT_PLAN_CURRENCY, LISTED_CURRENCIES } from '@/shared/domain/planPricing';
import { SqliteAdminAuditLogRepository } from '@/contexts/identity/infrastructure/persistence/SqliteAdminAuditLogRepository';
import { SqlitePlatformSettingsRepository } from '@/contexts/identity/infrastructure/persistence/SqlitePlatformSettingsRepository';
import {
  REFERRAL_PROGRAM_SETTINGS_KEY,
  type ReferralProgramConfig,
} from '@/contexts/identity/domain/value-objects/referralProgram';
import { requireAdmin } from '../requireAdmin';

export interface PlanFormState {
  ok?: string;
  error?: string;
}

/** '' ⇒ null (sin tope); número ⇒ valor en COP; otra cosa ⇒ inválido. */
function parseBudget(raw: FormDataEntryValue | null): number | null | 'invalido' {
  const value = String(raw ?? '').trim();
  if (value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalido';
  return parsed;
}

export async function updatePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const admin = await requireAdmin();
  try {
    const planId = String(formData.get('plan') ?? '');
    const plan = await findPlan(planId);
    if (!plan) return { error: 'Plan desconocido.' };

    const prices: Record<string, number> = {};
    for (const code of LISTED_CURRENCIES) {
      const raw = String(formData.get(`precio_${code}`) ?? '').trim();
      if (raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return { error: `El precio en ${code} no es un número válido.` };
      }
      prices[code] = value;
    }
    if (prices[DEFAULT_PLAN_CURRENCY] === undefined) {
      return { error: `El precio en ${DEFAULT_PLAN_CURRENCY} es obligatorio (moneda por defecto del producto).` };
    }

    const aiMonthlyBudgetCop = parseBudget(formData.get('tope_duro'));
    if (aiMonthlyBudgetCop === 'invalido') return { error: 'El tope duro de IA no es un número válido.' };
    const aiSoftBudgetCop = parseBudget(formData.get('tope_suave'));
    if (aiSoftBudgetCop === 'invalido') return { error: 'El umbral suave de IA no es un número válido.' };

    const waMonthlyLimitRaw = parseBudget(formData.get('limite_wa'));
    if (waMonthlyLimitRaw === 'invalido' || (waMonthlyLimitRaw !== null && !Number.isInteger(waMonthlyLimitRaw))) {
      return { error: 'El límite de WhatsApp debe ser un número entero (o vacío para sin límite).' };
    }
    const waMonthlyLimit = waMonthlyLimitRaw;

    const highlighted = formData.get('destacado') === 'on' ? 1 : 0;

    await getDatabaseAdapter().execute(
      `UPDATE plans
            SET prices_json = ?, ai_monthly_budget_cop = ?, ai_soft_budget_cop = ?, wa_monthly_limit = ?, highlighted = ?
          WHERE id = ?`,
      [JSON.stringify(prices), aiMonthlyBudgetCop, aiSoftBudgetCop, waMonthlyLimit, highlighted, planId],
    );

    await new SqliteAdminAuditLogRepository().record({
      actorUserId: admin.userId,
      action: 'editar_plan',
      target: planId,
      details: {
        prices,
        aiMonthlyBudgetCop,
        aiSoftBudgetCop,
        waMonthlyLimit,
        highlighted: highlighted === 1,
      },
    });

    revalidatePath('/admin/planes');
    revalidatePath('/suscripcion');
    revalidatePath('/');
    return { ok: `Plan ${plan.name} actualizado.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar el plan.' };
  }
}

/**
 * Configuración del programa de referidos (v3 §11): porcentaje por referido
 * activo, tope acumulado y meses máximos. Vive en platform_settings.
 */
export async function updateReferralProgramAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const admin = await requireAdmin();
  try {
    const readPercent = (name: string, max: number): number | 'invalido' => {
      const value = Number(String(formData.get(name) ?? '').trim());
      if (!Number.isFinite(value) || value < 0 || value > max) return 'invalido';
      return value;
    };

    const descuentoPorcentaje = readPercent('descuento', 100);
    if (descuentoPorcentaje === 'invalido') {
      return { error: 'El descuento por referido debe ser un porcentaje entre 0 y 100.' };
    }
    const maxPorcentaje = readPercent('max_porcentaje', 100);
    if (maxPorcentaje === 'invalido') {
      return { error: 'El descuento máximo debe ser un porcentaje entre 0 y 100.' };
    }
    const maxMeses = Number(String(formData.get('max_meses') ?? '').trim());
    if (!Number.isInteger(maxMeses) || maxMeses < 1 || maxMeses > 60) {
      return { error: 'Los meses máximos deben ser un entero entre 1 y 60.' };
    }

    const config: ReferralProgramConfig = { descuentoPorcentaje, maxPorcentaje, maxMeses };
    await new SqlitePlatformSettingsRepository().set(REFERRAL_PROGRAM_SETTINGS_KEY, JSON.stringify(config));

    await new SqliteAdminAuditLogRepository().record({
      actorUserId: admin.userId,
      action: 'configurar_programa_referidos',
      target: REFERRAL_PROGRAM_SETTINGS_KEY,
      details: { ...config },
    });

    revalidatePath('/admin/planes');
    revalidatePath('/configuracion/suscripcion');
    return { ok: 'Programa de referidos actualizado.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se pudo actualizar el programa de referidos.',
    };
  }
}
