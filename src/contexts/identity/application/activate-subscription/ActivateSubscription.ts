import { SubscriptionNotFoundError } from '../../domain/errors/SubscriptionNotFoundError';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { ReferralRepository } from '../../domain/repositories/ReferralRepository';
import type { PlatformSettingsRepository } from '../../domain/repositories/PlatformSettingsRepository';
import type { ReferralActivationNotifier } from '../../domain/ReferralActivationNotifier';
import {
  applyReferralDiscount,
  parseReferralProgramConfig,
  referralDiscountPercent,
  REFERRAL_PROGRAM_SETTINGS_KEY,
} from '../../domain/value-objects/referralProgram';

export const PRO_PLAN_PRICE_MXN = 499;

export interface ActivateSubscriptionOptions {
  /** Plan elegido (id de la tabla `plans`); si se omite, conserva el plan actual. */
  planId?: string;
  /** Monto de LISTA y moneda del cobro simulado; default histórico: 499 MXN. */
  amount?: number;
  currency?: string;
  /** Días del periodo activado (default 30). Permite periodos anuales desde /admin. */
  periodDays?: number;
  /**
   * Clave de idempotencia del COBRO (opcional). Si se repite un pago con la misma clave
   * (reintento de red / doble clic), no se cobra ni se extiende el periodo dos veces. El
   * flujo de pago del usuario la envía; el admin/los tests no la usan (comportamiento previo).
   */
  idempotencyKey?: string | null;
}

export interface ActivationResult {
  /** Monto efectivamente cobrado (lista − descuento de referidos, v3 §11). */
  amountCharged: number;
  /** Descuento aplicado al usuario que paga (sus referidos activos). */
  discountPercent: number;
  /** true si el cobro ya se había aplicado con esa clave (reintento idempotente, no se cobró). */
  alreadyApplied?: boolean;
}

/**
 * Activa la suscripción con pago SIMULADO (modo local): guarda el plan elegido
 * en subscriptions.plan, registra el pago en subscription_payments, marca
 * status='activa' y extiende el periodo 30 días.
 *
 * Programa de referidos (v3 §11): al monto se le aplica el descuento por
 * referidos activos del pagador; si el pagador era a su vez un referido
 * 'registrado', su referral pasa a 'activo' y el referente recibe una
 * notificación in-app.
 */
export class ActivateSubscription {
  public constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly referrals?: ReferralRepository,
    private readonly settings?: PlatformSettingsRepository,
    private readonly referralNotifier?: ReferralActivationNotifier,
  ) {}

  public async activate(
    userId: string,
    options: ActivateSubscriptionOptions = {},
  ): Promise<ActivationResult> {
    const subscription = await this.subscriptions.findByUserId(userId);
    if (!subscription) throw new SubscriptionNotFoundError(userId);

    // Idempotencia del cobro: si ya se aplicó un pago con esta clave (reintento), no se
    // re-activa ni se vuelve a cobrar. (Debe correr dentro de la transacción del action, que
    // abre BEGIN IMMEDIATE, para que dos reintentos simultáneos se serialicen; el índice único
    // de subscription_payments es el respaldo final si aun así se colaran ambos.)
    if (options.idempotencyKey && (await this.subscriptions.hasPaymentWithKey(options.idempotencyKey))) {
      return { amountCharged: 0, discountPercent: 0, alreadyApplied: true };
    }

    if (options.planId) subscription.switchPlan(options.planId);
    subscription.activate(undefined, options.periodDays);
    await this.subscriptions.save(subscription);

    const config = parseReferralProgramConfig(
      (await this.settings?.get(REFERRAL_PROGRAM_SETTINGS_KEY)) ?? null,
    );
    const discountPercent = this.referrals
      ? referralDiscountPercent(await this.referrals.countActiveFor(userId), config)
      : 0;
    const amountCharged = applyReferralDiscount(options.amount ?? PRO_PLAN_PRICE_MXN, discountPercent);

    await this.subscriptions.recordSimulatedPayment(
      subscription.subscriptionId(),
      amountCharged,
      options.currency ?? 'MXN',
      options.idempotencyKey ?? null,
    );

    // Primer pago de un referido: su referral pasa a 'activo' (idempotente)
    // y el referente recibe el aviso con su descuento acumulado.
    const activation = (await this.referrals?.activateForReferredUser(userId)) ?? null;
    if (activation && this.referralNotifier && this.referrals) {
      await this.referralNotifier.notifyReferralActivated({
        referrerUserId: activation.referrerUserId,
        referredDisplayName: activation.referredDisplayName,
        discountPercent: referralDiscountPercent(
          await this.referrals.countActiveFor(activation.referrerUserId),
          config,
        ),
      });
    }

    return { amountCharged, discountPercent };
  }
}
