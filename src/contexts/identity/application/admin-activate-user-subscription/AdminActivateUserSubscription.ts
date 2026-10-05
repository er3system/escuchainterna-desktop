import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';
import {
  ActivateSubscription,
  type ActivateSubscriptionOptions,
} from '../activate-subscription/ActivateSubscription';

/**
 * Activación/cambio manual de la suscripción de un usuario desde /admin: el admin
 * puede elegir el plan, el periodo (días) y el monto/moneda del cobro simulado.
 * Reutiliza el caso de uso de activación y registra auditoría.
 */
export class AdminActivateUserSubscription {
  public constructor(
    private readonly activateSubscription: ActivateSubscription,
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async activate(
    actorUserId: string,
    targetUserId: string,
    options: ActivateSubscriptionOptions = {},
  ): Promise<void> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    await this.activateSubscription.activate(targetUserId, options);

    await this.audit.record({
      actorUserId,
      action: 'activar_suscripcion',
      target: account.accountEmail(),
      details: { userId: targetUserId, planId: options.planId ?? null, periodDays: options.periodDays ?? 30 },
    });
  }
}
