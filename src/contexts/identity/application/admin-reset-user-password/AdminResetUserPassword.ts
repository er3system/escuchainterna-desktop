import { clearLoginAttempts } from '@/shared/infrastructure/auth/loginAttempts';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';
import { RequestPasswordReset } from '../request-password-reset/RequestPasswordReset';

/**
 * Resetear contraseña desde /admin: genera el token de 1 hora (vía el caso de
 * uso de recuperación, que también "envía" el correo por outbox) y devuelve el
 * enlace para mostrárselo al admin. Registra auditoría.
 */
export class AdminResetUserPassword {
  public constructor(
    private readonly requestPasswordReset: RequestPasswordReset,
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async reset(actorUserId: string, targetUserId: string, baseUrl: string): Promise<string> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    const { resetUrl } = await this.requestPasswordReset.request(account.accountEmail(), baseUrl);
    if (!resetUrl) throw new UserNotFoundError(targetUserId);

    // Resetear la contraseña también desbloquea el login: si la cuenta estaba
    // bloqueada por intentos fallidos, el enlace sería inútil sin esto.
    await clearLoginAttempts(account.accountEmail());

    await this.audit.record({
      actorUserId,
      action: 'resetear_contrasena',
      target: account.accountEmail(),
      details: { userId: targetUserId },
    });
    return resetUrl;
  }
}
