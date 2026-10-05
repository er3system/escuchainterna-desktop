import type { UserStatus } from '../../domain/UserAccount';
import { AdminCannotSuspendSelfError } from '../../domain/errors/AdminCannotSuspendSelfError';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

/** Suspende o reactiva una cuenta desde /admin (con registro en auditoría). */
export class AdminSetUserStatus {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async setStatus(actorUserId: string, targetUserId: string, status: UserStatus): Promise<void> {
    if (status === 'suspendido' && actorUserId === targetUserId) {
      throw new AdminCannotSuspendSelfError();
    }
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    if (status === 'suspendido') account.suspend();
    else account.reactivate();
    await this.accounts.save(account);

    await this.audit.record({
      actorUserId,
      action: status === 'suspendido' ? 'suspender_usuario' : 'reactivar_usuario',
      target: account.accountEmail(),
      details: { userId: targetUserId },
    });
  }
}
