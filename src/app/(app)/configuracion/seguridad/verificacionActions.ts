'use server';

import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';

export interface ResendEmailVerificationResult {
  ok: boolean;
}

/**
 * Reenvía el correo de verificación al usuario en sesión (botón "Reenviar" del
 * banner). Genera un token nuevo de 7 días y lo "envía" por el outbox. No revela
 * si el correo ya estaba verificado: siempre responde ok (idempotente, no enumera).
 */
export async function resendEmailVerificationAction(): Promise<ResendEmailVerificationResult> {
  const userId = await requireSessionUserId();
  try {
    await createIdentityUseCases().requestEmailVerification.request(userId, getAppBaseUrl());
  } catch {
    return { ok: false };
  }
  return { ok: true };
}
