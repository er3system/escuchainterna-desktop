import { SubscriptionNotFoundError } from '../../domain/errors/SubscriptionNotFoundError';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';

/**
 * Reanuda una suscripción que se había cancelado «al fin de periodo» (antes de que el
 * periodo termine): limpia canceledAt y la suscripción vuelve a renovarse con normalidad.
 */
export class ResumeSubscription {
  public constructor(private readonly subscriptions: SubscriptionRepository) {}

  public async resume(userId: string): Promise<void> {
    const subscription = await this.subscriptions.findByUserId(userId);
    if (!subscription) throw new SubscriptionNotFoundError(userId);
    subscription.resume();
    await this.subscriptions.save(subscription);
  }
}
