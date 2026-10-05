import type { PatientConsentPrimitives } from '../../domain/PatientConsent';
import { ConsentNotFoundError } from '../../domain/errors/ConsentNotFoundError';
import type { ConsentByTokenRepository } from '../../domain/repositories/ConsentByTokenRepository';
import type { SignPatientConsentMessage } from './SignPatientConsentMessage';

/**
 * Firma digital desde la página pública (v3 §2 paso 2): valida el token,
 * registra nombre completo + aceptación y deja el consentimiento en
 * 'firmado'. Idempotente: firmar dos veces no altera la primera firma.
 */
export class SignPatientConsent {
  public constructor(private readonly consents: ConsentByTokenRepository) {}

  public async execute(message: SignPatientConsentMessage): Promise<PatientConsentPrimitives> {
    const consent = await this.consents.findByToken(message.token());
    if (!consent) throw new ConsentNotFoundError();

    const before = consent.toPrimitives().status;
    consent.signDigitally(message.signedName());
    if (before !== consent.toPrimitives().status) await this.consents.save(consent);
    return consent.toPrimitives();
  }
}
