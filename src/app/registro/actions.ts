'use server';

import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { RegisterPractitionerMessage } from '@/contexts/identity/application/register-practitioner/RegisterPractitionerMessage';
import { createSession } from '@/shared/infrastructure/auth/session';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export interface RegisterFormState {
  error?: string;
}

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  let userId: string;
  const identity = createIdentityUseCases();
  try {
    const message = new RegisterPractitionerMessage({
      fullName: String(formData.get('nombre') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      phoneDialCode: String(formData.get('lada') ?? '+57'),
      phoneNumber: String(formData.get('telefono') ?? ''),
      acceptedTerms: formData.get('terminos') === 'on' || formData.get('terminos') === '1',
      referralCode: isDesktopEdition() ? null : String(formData.get('ref') ?? ''),
    });
    userId = await getDatabaseAdapter().transaction(() =>
      identity.registerPractitioner.register(message),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' };
  }
  // Doble opt-in NO bloqueante: se envía el correo de verificación pero el alta no
  // depende de su éxito. La cuenta queda usable; el banner recuerda confirmar.
  if (!isDesktopEdition()) {
    try {
      await identity.requestEmailVerification.request(userId, getAppBaseUrl());
    } catch {
      /* el envío nunca debe impedir el registro */
    }
  }
  await createSession(userId);
  if (isDesktopEdition() && formData.get('synchronization') === 'drive') redirect('/sincronizacion?registro=1');
  redirect('/onboarding');
}
