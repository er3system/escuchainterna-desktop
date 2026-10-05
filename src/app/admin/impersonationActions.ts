'use server';

import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import {
  getImpersonatorUserId,
  getSessionUserId,
  startImpersonation,
  stopImpersonation,
} from '@/shared/infrastructure/auth/session';
import { requireAdmin } from './requireAdmin';

export interface ImpersonationResult {
  error?: string;
}

/**
 * "Ver la app como este usuario": inicia una sesión impersonada (solo admin) y
 * aterriza en el home del rol del usuario. Queda registrado en admin_audit_log.
 * En éxito redirige (no retorna); solo retorna en los caminos de error.
 */
export async function impersonateAction(targetUserId: string): Promise<ImpersonationResult> {
  const admin = await requireAdmin();
  const target = await createIdentityUseCases().getSessionContext.get(targetUserId);
  if (!target) return { error: 'No se encontró la cuenta a impersonar.' };
  if (targetUserId === admin.userId) return { error: 'No puedes verte como tú mismo.' };
  if (target.status === 'suspendido') {
    return { error: 'La cuenta está suspendida; reactívala antes de verla.' };
  }

  await createAdminUseCases().audit.record({
    actorUserId: admin.userId,
    action: 'entrar_como',
    target: target.email,
    details: { userId: targetUserId, role: target.role },
  });

  await startImpersonation(targetUserId, admin.userId);
  redirect(homePathForRole(target.role, target.onboardingCompleted));
}

/**
 * Termina la impersonación: restaura la sesión del admin real y registra la
 * salida. La invoca el banner persistente desde cualquier superficie.
 */
export async function stopImpersonationAction(): Promise<void> {
  const adminUserId = await getImpersonatorUserId();
  if (!adminUserId) redirect('/login');

  const adminCtx = await createIdentityUseCases().getSessionContext.get(adminUserId);
  const targetUserId = await getSessionUserId();
  const targetCtx = targetUserId
    ? await createIdentityUseCases().getSessionContext.get(targetUserId)
    : null;

  await stopImpersonation(); // restaura la sesión del admin y borra la cookie

  if (adminCtx && adminCtx.role === 'admin') {
    await createAdminUseCases().audit.record({
      actorUserId: adminUserId,
      action: 'salir_impersonacion',
      target: targetCtx?.email ?? targetUserId ?? '',
      details: { userId: targetUserId },
    });
    redirect('/admin/cuentas');
  }
  redirect('/login');
}
