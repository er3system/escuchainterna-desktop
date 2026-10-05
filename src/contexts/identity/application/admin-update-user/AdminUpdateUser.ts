import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';
import type { ProfileProvisioner } from '../../domain/ProfileProvisioner';
import { isUserRole, type UserRole } from '../../domain/value-objects/UserRole';

export interface AdminUpdateUserInput {
  /** Nombre mostrado (practitioner_profile). Undefined = no tocar. */
  fullName?: string;
  /** Correo de la cuenta (users.email). Undefined = no tocar. */
  email?: string;
  /** Rol de plataforma (users.role). Undefined = no tocar. */
  role?: string;
}

/**
 * Edita los datos de una cuenta desde /admin: nombre (perfil), correo y rol.
 * Guardas: rol válido, no cambiar el PROPIO rol (evita auto-bloqueo del admin),
 * correo único. Registra auditoría con la lista de campos cambiados.
 */
export class AdminUpdateUser {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly profiles: ProfileProvisioner,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async update(actorUserId: string, targetUserId: string, input: AdminUpdateUserInput): Promise<void> {
    const account = await this.accounts.findById(targetUserId);
    if (!account) throw new UserNotFoundError(targetUserId);

    const changed: string[] = [];

    if (input.role !== undefined && input.role !== account.accountRole()) {
      if (!isUserRole(input.role)) throw new Error('Rol no válido.');
      if (actorUserId === targetUserId) throw new Error('No puedes cambiar tu propio rol.');
      account.changeRole(input.role as UserRole);
      changed.push(`rol→${input.role}`);
    }

    if (input.email !== undefined) {
      const normalized = input.email.toLowerCase().trim();
      if (!normalized.includes('@')) throw new Error('El correo no es válido.');
      if (normalized !== account.accountEmail()) {
        const existing = await this.accounts.findByEmail(normalized);
        if (existing && existing.accountId() !== targetUserId) {
          throw new Error('Ese correo ya está en uso por otra cuenta.');
        }
        account.changeEmail(normalized);
        changed.push('correo');
      }
    }

    await this.accounts.save(account);

    if (input.fullName !== undefined && input.fullName.trim()) {
      await this.profiles.updateFullName(targetUserId, input.fullName);
      changed.push('nombre');
    }

    if (changed.length === 0) return;

    await this.audit.record({
      actorUserId,
      action: 'editar_cuenta',
      target: account.accountEmail(),
      details: { userId: targetUserId, changed },
    });
  }
}
