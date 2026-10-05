'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { destroySession, requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { findPlan } from '@/shared/infrastructure/persistence/PlanCatalog';
import {
  formatPlanPrice,
  resolveCurrencyFromAcceptLanguage,
} from '@/shared/domain/planPricing';

export interface ActivateSubscriptionState {
  error?: string;
}

/** Planes autocontratables desde el paywall; organizacion se gestiona con el administrador. */
const SELF_SERVE_PLAN_IDS = ['esencial', 'profesional'];

export async function activateSubscriptionAction(
  _prev: ActivateSubscriptionState,
  formData: FormData,
): Promise<ActivateSubscriptionState> {
  const userId = await requireSessionUserId();
  const useCases = createIdentityUseCases();
  try {
    const planId = String(formData.get('plan') ?? 'profesional');
    if (!SELF_SERVE_PLAN_IDS.includes(planId)) {
      return {
        error:
          'Ese plan no se activa desde aquí: el plan Organizaciones lo gestiona el administrador de tu institución.',
      };
    }
    const plan = await findPlan(planId);
    if (!plan) return { error: 'Plan desconocido.' };

    // Cobro simulado en la moneda detectada por Accept-Language (default COP).
    const headerList = await headers();
    const price = formatPlanPrice(
      plan.prices,
      resolveCurrencyFromAcceptLanguage(headerList.get('accept-language')),
    );
    // Clave de idempotencia del botón (estable por intento): un reintento de red / doble clic
    // con la MISMA clave no cobra dos veces. La transacción del adaptador agrupa la activación
    // y el pago; el índice único de subscription_payments resuelve la carrera concurrente.
    const rawKey = formData.get('idempotencyKey');
    if (typeof rawKey !== 'string' || rawKey.trim() === '') {
      return {
        error: 'No se recibió la clave de seguridad del pago. Actualiza la página e inténtalo de nuevo.',
      };
    }
    const idempotencyKey = rawKey.trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return {
        error: 'La clave de seguridad del pago no es válida. Actualiza la página e inténtalo de nuevo.',
      };
    }
    await getDatabaseAdapter().transaction(() =>
      useCases.activateSubscription.activate(userId, {
        planId,
        amount: price.amount,
        currency: price.currency,
        idempotencyKey,
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo activar la suscripción.' };
  }
  const context = await useCases.getSessionContext.get(userId);
  redirect(context ? homePathForRole(context.role, context.onboardingCompleted) : '/inicio');
}

export async function logoutFromPaywallAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
