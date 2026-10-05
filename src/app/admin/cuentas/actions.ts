'use server';

import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AdminCreateUserMessage } from '@/contexts/identity/application/admin-create-user/AdminCreateUserMessage';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { findPlan } from '@/shared/infrastructure/persistence/PlanCatalog';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { bumpSessionEpoch } from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  countClinicalData,
  isOrganizationMaster,
  purgeAccountData,
} from '@/shared/infrastructure/account-data/AccountDataPurge';
import { requireAdmin } from '../requireAdmin';
import { readPermissionsFromForm } from '../permissionsForm';

export interface CreateUserState {
  ok?: string;
  error?: string;
  /** Contraseña temporal generada (solo si el admin no fijó una). */
  temporaryPassword?: string | null;
}

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const admin = await requireAdmin();
  try {
    const organizationId = String(formData.get('organizacion') ?? '').trim() || null;
    const customizePermissions = formData.get('personalizar_permisos') === 'on';
    const message = new AdminCreateUserMessage({
      actorUserId: admin.userId,
      email: String(formData.get('email') ?? ''),
      fullName: String(formData.get('nombre') ?? ''),
      role: String(formData.get('rol') ?? 'psychologist'),
      password: String(formData.get('password') ?? ''),
      organizationId,
      permissions: customizePermissions && organizationId ? readPermissionsFromForm(formData) : null,
    });
    const result = await createAdminUseCases().createUser.create(message);
    revalidatePath('/admin/cuentas');
    revalidatePath('/admin');
    return {
      ok: 'Cuenta creada correctamente (suscripción activa, sin paywall).',
      temporaryPassword: result.temporaryPassword,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' };
  }
}

export interface AccountActionResult {
  ok?: string;
  error?: string;
  /** Enlace de recuperación generado al resetear la contraseña. */
  resetUrl?: string;
}

export async function setUserStatusAction(
  targetUserId: string,
  status: 'activo' | 'suspendido',
): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    await createAdminUseCases().setUserStatus.setStatus(admin.userId, targetUserId, status);
    // SEG-4: al suspender, rota el epoch → las cookies vigentes del usuario dejan de valer
    // de inmediato (también en rutas API que no pasan por el re-chequeo del layout).
    if (status === 'suspendido') await bumpSessionEpoch(targetUserId);
    revalidatePath('/admin/cuentas');
    revalidatePath('/admin');
    return { ok: status === 'suspendido' ? 'Cuenta suspendida.' : 'Cuenta reactivada.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' };
  }
}

export async function extendTrialAction(targetUserId: string, days: number): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    const newTrialEnd = await createAdminUseCases().extendTrial.extend(admin.userId, targetUserId, days);
    revalidatePath('/admin/cuentas');
    return {
      ok: `Trial extendido hasta el ${format(new Date(newTrialEnd), "d 'de' MMMM 'de' yyyy", { locale: es })}.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo extender el trial.' };
  }
}

export async function activateSubscriptionAction(
  targetUserId: string,
  planId?: string,
  periodDays?: number,
): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    const plan = planId ? await findPlan(planId) : null;
    // Cobro simulado en COP (moneda del producto) con el precio de lista del plan.
    const amount = plan ? plan.prices.COP : undefined;
    await createAdminUseCases().activateUserSubscription.activate(admin.userId, targetUserId, {
      planId: plan?.id,
      amount,
      currency: amount !== undefined ? 'COP' : undefined,
      periodDays,
    });
    revalidatePath('/admin/cuentas');
    revalidatePath('/admin');
    const periodLabel = periodDays && periodDays >= 360 ? '12 meses' : '30 días';
    const planLabel = plan ? ` · plan ${plan.name}` : '';
    return { ok: `Suscripción activada (pago simulado, ${periodLabel}${planLabel}).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo activar la suscripción.' };
  }
}

export async function updateUserAction(
  targetUserId: string,
  input: { fullName?: string; email?: string; role?: string },
): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    await createAdminUseCases().updateUser.update(admin.userId, targetUserId, input);
    revalidatePath('/admin/cuentas');
    revalidatePath('/admin');
    return { ok: 'Datos de la cuenta actualizados.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudieron actualizar los datos.' };
  }
}

export async function deleteUserAction(
  targetUserId: string,
  confirmEmail: string,
): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    if (targetUserId === admin.userId) return { error: 'No puedes eliminar tu propia cuenta.' };

    const row = (await getDatabaseAdapter().queryRow('SELECT email, role FROM users WHERE id = ?', [
      targetUserId,
    ])) as { email: string; role: string } | null;
    if (!row) return { error: 'Cuenta no encontrada.' };
    if (row.role === 'admin') return { error: 'No puedes eliminar otra cuenta de administración.' };
    if (confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()) {
      return { error: 'El correo de confirmación no coincide. Escribe el correo exacto de la cuenta.' };
    }
    if (await isOrganizationMaster(targetUserId)) {
      return {
        error: 'Esta cuenta es maestra de una organización. Transfiere o elimina la organización antes.',
      };
    }

    // Salvaguarda de retención: no se borran cuentas con datos clínicos.
    const clinical = await countClinicalData(targetUserId);
    if (clinical.total > 0) {
      return {
        error: `No se puede eliminar: la cuenta conserva datos clínicos bajo retención (${clinical.patients} pacientes, ${clinical.notes} notas de sesión, ${clinical.records} historias, ${clinical.diagnoses} diagnósticos). Exporta los datos o transfiere la custodia antes de eliminar.`,
      };
    }

    // Borrado + auditoría ATÓMICOS: la traza y el purge confirman o revierten juntos.
    // (El email/target se capturó arriba, así que sigue disponible tras el DELETE de la
    // cuenta; admin_audit_log no se purga.) Si el purge lanzara, no queda un log falso.
    await getDatabaseAdapter().transaction(async () => {
      await purgeAccountData(targetUserId);
      await createAdminUseCases().audit.record({
        actorUserId: admin.userId,
        action: 'eliminar_cuenta',
        target: row.email,
        details: { userId: targetUserId },
      });
    });

    revalidatePath('/admin/cuentas');
    revalidatePath('/admin');
    return { ok: 'Cuenta y datos eliminados definitivamente.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.' };
  }
}

export async function setUserLimitsAction(
  targetUserId: string,
  overrides: {
    aiMonthlyBudgetCop: number | null;
    aiSoftBudgetCop: number | null;
    waMonthlyLimit: number | null;
    storageLimitGb: number | null;
  },
): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    await createAdminUseCases().setUserLimits.setLimits(admin.userId, targetUserId, overrides);
    revalidatePath('/admin/cuentas');
    return { ok: 'Topes de la cuenta actualizados (vacío = se usa el plan).' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudieron ajustar los topes.' };
  }
}

export async function resetUserPasswordAction(targetUserId: string): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const resetUrl = await createAdminUseCases().resetUserPassword.reset(admin.userId, targetUserId, baseUrl);
    revalidatePath('/admin/cuentas');
    // SEG-1: en producción el enlace NO vuelve al navegador del admin (sería tomar la cuenta
    // del titular sin su intervención); viaja por el notificador hacia su correo. Solo en dev
    // se muestra para poder probar el flujo sin proveedor de correo.
    return {
      ok: 'Enlace de recuperación generado (válido 1 hora). También se desbloqueó el acceso.',
      resetUrl: isProduction() ? undefined : resetUrl,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo generar el enlace.' };
  }
}

export async function unlockLoginAction(targetUserId: string): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    await createAdminUseCases().unlockLogin.unlock(admin.userId, targetUserId);
    revalidatePath('/admin/cuentas');
    return { ok: 'Acceso desbloqueado: el contador de intentos fallidos quedó en cero.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo desbloquear el acceso.' };
  }
}

export async function disableTotpAction(targetUserId: string): Promise<AccountActionResult> {
  const admin = await requireAdmin();
  try {
    await createAdminUseCases().disableUserTotp.disable(admin.userId, targetUserId);
    revalidatePath('/admin/cuentas');
    return { ok: 'Verificación en dos pasos (2FA) desactivada para esta cuenta.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo desactivar el 2FA.' };
  }
}
