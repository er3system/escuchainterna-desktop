'use server';

import { revalidatePath } from 'next/cache';
import { SignPatientConsent } from '@/contexts/clinical-records/application/sign-patient-consent/SignPatientConsent';
import { SignPatientConsentMessage } from '@/contexts/clinical-records/application/sign-patient-consent/SignPatientConsentMessage';
import { SqliteConsentByToken } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentByToken';

export interface FirmaState {
  ok: boolean;
  error?: string;
  signedName?: string;
  signedAt?: string;
}

/**
 * Firma PÚBLICA del consentimiento: el token único es la credencial (no hay
 * sesión). Idempotente — firmar de nuevo no altera la primera firma.
 */
export async function firmarConsentimientoAction(
  token: string,
  formData: FormData,
): Promise<FirmaState> {
  try {
    const result = await new SignPatientConsent(new SqliteConsentByToken()).execute(
      new SignPatientConsentMessage({
        token,
        signedName: String(formData.get('nombre') ?? ''),
        accepted: formData.get('acepto') === '1',
      }),
    );
    revalidatePath(`/consentimiento/${token}`);
    return { ok: true, signedName: result.signedName, signedAt: result.signedAt ?? undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo registrar la firma. Intenta de nuevo.',
    };
  }
}
