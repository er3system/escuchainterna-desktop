import { Subscription } from '../../domain/Subscription';
import { InvalidTrialExtensionError } from '../../domain/errors/InvalidTrialExtensionError';
import { SubscriptionNotFoundError } from '../../domain/errors/SubscriptionNotFoundError';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extiende el trial de un usuario N días desde /admin. Si el trial ya venció,
 * los días se cuentan desde hoy y la suscripción vuelve a estado 'trial'
 * (así el gate del layout vuelve a dejarlo entrar).
 */
export class AdminExtendTrial {
  public constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async extend(actorUserId: string, targetUserId: string, days: number, now: Date = new Date()): Promise<string> {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new InvalidTrialExtensionError(days);
    }
    const subscription = await this.subscriptions.findByUserId(targetUserId);
    if (!subscription) throw new SubscriptionNotFoundError(targetUserId);

    const primitives = subscription.toPrimitives();
    const base = Math.max(now.getTime(), new Date(primitives.trialEndsAt).getTime());
    const newTrialEnd = new Date(base + days * DAY_MS).toISOString();
    // No degradar una suscripción ACTIVA (pagada/cubierta) a 'trial': eso le quitaría
    // su currentPeriodEnd vigente y la expondría al paywall al vencer el trial extendido.
    // Solo las que NO están activas vuelven a 'trial' (para que el gate las deje entrar).
    const status = primitives.status === 'activa' ? 'activa' : 'trial';
    await this.subscriptions.save(
      Subscription.fromPrimitives({ ...primitives, status, trialEndsAt: newTrialEnd }),
    );

    await this.audit.record({
      actorUserId,
      action: 'extender_trial',
      target: targetUserId,
      details: { days, trialEndsAt: newTrialEnd },
    });
    return newTrialEnd;
  }
}
