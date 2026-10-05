'use server';

import { revalidatePath } from 'next/cache';
import {
  bumpSessionEpoch,
  createSession,
  requireSessionUserId,
} from '@/shared/infrastructure/auth/session';
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
} from '@/shared/infrastructure/auth/totp';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface TotpSetupResult {
  qrDataUrl?: string;
  secret?: string;
  error?: string;
}

export interface TotpFormState {
  ok?: boolean;
  error?: string;
}

/** Genera secreto + QR para empezar la activación (queda pendiente de confirmar). */
export async function startTotpSetupAction(): Promise<TotpSetupResult> {
  const userId = await requireSessionUserId();
  const setup = await beginTotpSetup(userId);
  if (!setup) return { error: 'No se pudo iniciar la configuración. Intenta de nuevo.' };
  return { qrDataUrl: setup.qrDataUrl, secret: setup.secret };
}

/** Confirma la activación con un código válido de la app. */
export async function confirmTotpAction(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const userId = await requireSessionUserId();
  const code = String(formData.get('codigo') ?? '').trim();
  const ok = await confirmTotpSetup(userId, code);
  if (!ok) return { error: 'Código incorrecto. Escanea el QR de nuevo si hace falta e inténtalo otra vez.' };
  revalidatePath('/configuracion/seguridad');
  return { ok: true };
}

export interface CloseSessionsState {
  ok?: boolean;
  error?: string;
}

/**
 * «Cerrar todas mis sesiones» (SEG-4): rota el epoch del usuario —invalidando cualquier
 * cookie vigente en otros dispositivos— y re-firma ESTA sesión para no cerrar el dispositivo
 * actual. Útil si sospechas que dejaste una sesión abierta sin cambiar la contraseña.
 */
export async function closeOtherSessionsAction(
  _prev: CloseSessionsState,
  _formData: FormData,
): Promise<CloseSessionsState> {
  const userId = await requireSessionUserId();
  try {
    await getDatabaseAdapter().transaction(() => bumpSessionEpoch(userId));
  } catch {
    return { error: 'No se pudieron cerrar las demás sesiones. Inténtalo de nuevo.' };
  }
  try {
    await createSession(userId);
  } catch {
    return {
      error:
        'Las demás sesiones se cerraron, pero no pudimos renovar esta sesión. Vuelve a iniciar sesión.',
    };
  }
  revalidatePath('/configuracion/seguridad');
  return { ok: true };
}

/** Desactiva el 2FA (pide un código válido). */
export async function disableTotpAction(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const userId = await requireSessionUserId();
  const code = String(formData.get('codigo') ?? '').trim();
  const ok = await disableTotp(userId, code);
  if (!ok) return { error: 'Código incorrecto. Para desactivar el segundo factor necesitas un código vigente.' };
  revalidatePath('/configuracion/seguridad');
  return { ok: true };
}
