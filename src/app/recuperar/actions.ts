'use server';

import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { bumpSessionEpoch } from '@/shared/infrastructure/auth/session';

export interface RequestResetState {
  /** Se envió (o se simuló enviar) el correo de recuperación. */
  done?: boolean;
  /** Solo en modo local: el enlace que llegaría por correo. */
  resetUrl?: string | null;
  error?: string;
}

export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Escribe tu correo electrónico.' };
  try {
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const result = await createIdentityUseCases().requestPasswordReset.request(email, baseUrl);
    // No se revela si la cuenta existe: done=true siempre. El enlace SOLO se devuelve al
    // navegador en desarrollo; en producción viaja por el notificador (correo) y jamás se
    // expone aquí — devolverlo sería una toma de cuenta trivial para cualquier anónimo.
    return { done: true, resetUrl: isProduction() ? null : result.resetUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo generar el enlace.' };
  }
}

export interface ResetPasswordState {
  done?: boolean;
  error?: string;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmacion') ?? '');
  if (password !== confirmation) return { error: 'Las contraseñas no coinciden.' };
  try {
    const userId = await createIdentityUseCases().resetPassword.reset(token, password);
    // SEG-4: invalida cualquier sesión vigente del usuario tras el cambio de contraseña.
    await bumpSessionEpoch(userId);
    return { done: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo restablecer la contraseña.' };
  }
}
