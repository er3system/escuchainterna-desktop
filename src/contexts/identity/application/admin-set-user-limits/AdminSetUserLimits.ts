import {
  setUserLimitOverrides,
  type UserLimitOverrides,
} from '@/shared/infrastructure/billing-overrides/UserLimitOverrides';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

/**
 * Ajusta los overrides de topes (IA, WhatsApp, almacenamiento) de una cuenta
 * desde /admin. Cada campo null = volver al valor del plan. Registra auditoría.
 */
export class AdminSetUserLimits {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async setLimits(actorUserId: string, targetUserId: string, overrides: UserLimitOverrides): Promise<void> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    await setUserLimitOverrides(targetUserId, overrides);

    await this.audit.record({
      actorUserId,
      action: 'ajustar_limites',
      target: account.accountEmail(),
      details: { userId: targetUserId, ...overrides },
    });
  }
}
