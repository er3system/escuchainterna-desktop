'use server';

import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { InvalidCredentialsError } from '@/contexts/identity/domain/errors/InvalidCredentialsError';
import { homePathForRole, isUserRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import {
  clearTotpChallenge,
  createSession,
  createTotpChallenge,
  destroySession,
  readTotpChallenge,
} from '@/shared/infrastructure/auth/session';
import {
  clearLoginAttempts,
  lockStatus,
  registerFailedAttempt,
} from '@/shared/infrastructure/auth/loginAttempts';
import { totpEnabled, verifyUserTotp } from '@/shared/infrastructure/auth/totp';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface AuthFormState {
  error?: string;
}

function lockedMessage(minutesLeft: number): string {
  return `Demasiados intentos fallidos. Por seguridad, vuelve a intentarlo en ${minutesLeft} ${
    minutesLeft === 1 ? 'minuto' : 'minutos'
  }.`;
}

async function destinationFor(userId: string): Promise<string> {
  const row = (await getDatabaseAdapter().queryRow('SELECT role FROM users WHERE id = ?', [
    userId,
  ])) as { role: string } | null;
  const role = row && isUserRole(row.role) ? row.role : 'psychologist';
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(userId);
  return homePathForRole(role, profile?.onboardingCompleted ?? false);
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Bloqueo por intentos (v3 §1.3): aplica ANTES de validar, sin revelar si
  // el correo existe.
  const lock = await lockStatus(email);
  if (lock.locked) return { error: lockedMessage(lock.minutesLeft) };

  let userId: string;
  try {
    const result = await createIdentityUseCases().loginUser.login(email, password);
    userId = result.userId;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      const after = await registerFailedAttempt(email);
      return {
        error: after.locked
          ? lockedMessage(after.minutesLeft)
          : 'Correo o contraseña incorrectos.',
      };
    }
    return { error: error instanceof Error ? error.message : 'No se pudo iniciar sesión.' };
  }

  await clearLoginAttempts(email);

  // Segundo factor: con TOTP activo NO se crea sesión todavía; se emite un
  // reto temporal firmado (5 min) y se pide el código.
  if (await totpEnabled(userId)) {
    await createTotpChallenge(userId);
    redirect('/login/totp');
  }

  await createSession(userId);
  redirect(await destinationFor(userId));
}

export async function verifyTotpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const code = String(formData.get('codigo') ?? '').trim();

  const userId = await readTotpChallenge();
  if (!userId) redirect('/login');

  const userRow = (await getDatabaseAdapter().queryRow('SELECT email FROM users WHERE id = ?', [
    userId,
  ])) as { email: string } | null;
  if (!userRow) redirect('/login');

  const valid = await verifyUserTotp(userId, code);
  if (!valid) {
    // Los códigos fallidos también cuentan para el bloqueo del correo.
    const after = await registerFailedAttempt(userRow.email);
    if (after.locked) {
      await clearTotpChallenge();
      redirect('/login');
    }
    return { error: 'Código incorrecto. Revisa tu app de autenticación e inténtalo de nuevo.' };
  }

  await clearLoginAttempts(userRow.email);
  await clearTotpChallenge();
  await createSession(userId);
  redirect(await destinationFor(userId));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
