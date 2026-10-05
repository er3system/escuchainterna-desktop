import { SubscriptionNotFoundError } from '../../domain/errors/SubscriptionNotFoundError';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';

/**
 * Cancelación SELF-SERVICE de la suscripción «al fin de periodo»: marca la intención
 * (canceledAt) sin cortar el acceso. El status sigue 'activa' y el acceso dura hasta
 * currentPeriodEnd; a partir de ahí no se renueva. Reversible con ResumeSubscription
 * mientras el periodo siga vigente. La UI solo ofrece el botón a una suscripción activa
 * y de cobro directo (no trial, no cuentas cubiertas por la plataforma/organización).
 */
export class CancelSubscription {
  public constructor(private readonly subscriptions: SubscriptionRepository) {}

  public async cancel(userId: string): Promise<void> {
    const subscription = await this.subscriptions.findByUserId(userId);
    if (!subscription) throw new SubscriptionNotFoundError(userId);
    subscription.requestCancellation();
    await this.subscriptions.save(subscription);
  }
}
