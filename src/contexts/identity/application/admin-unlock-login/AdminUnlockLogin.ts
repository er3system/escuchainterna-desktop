import { clearLoginAttempts } from '@/shared/infrastructure/auth/loginAttempts';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

/**
 * Desbloquea el login de una cuenta desde /admin: limpia el contador de intentos
 * fallidos (`login_attempts`), que de otro modo mantiene el bloqueo de 15 min.
 * Registra auditoría. Idempotente (si no había bloqueo, no hace daño).
 */
export class AdminUnlockLogin {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async unlock(actorUserId: string, targetUserId: string): Promise<void> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    await clearLoginAttempts(account.accountEmail());

    await this.audit.record({
      actorUserId,
      action: 'desbloquear_acceso',
      target: account.accountEmail(),
      details: { userId: targetUserId },
    });
  }
}
