import { forceDisableTotp } from '@/shared/infrastructure/auth/totp';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

/**
 * Reset administrativo del 2FA de una cuenta desde /admin: para cuando el usuario
 * pierde su autenticador y no puede aportar un código válido. A diferencia de
 * `disableTotp` (que exige un token del propio usuario), aquí el admin lo limpia
 * sin token. Registra auditoría. Idempotente.
 */
export class AdminDisableUserTotp {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async disable(actorUserId: string, targetUserId: string): Promise<void> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    await forceDisableTotp(targetUserId);

    await this.audit.record({
      actorUserId,
      action: 'desactivar_2fa',
      target: account.accountEmail(),
      details: { userId: targetUserId },
    });
  }
}
