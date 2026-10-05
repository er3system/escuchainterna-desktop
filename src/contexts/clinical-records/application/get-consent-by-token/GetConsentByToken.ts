import type { PatientConsentPrimitives } from '../../domain/PatientConsent';
import type { ConsentByTokenRepository } from '../../domain/repositories/ConsentByTokenRepository';

/**
 * Lectura pública del consentimiento para la página de firma. Devuelve null
 * si el token no existe (la página responde 404 sin filtrar información).
 */
export class GetConsentByToken {
  public constructor(private readonly consents: ConsentByTokenRepository) {}

  public async execute(token: string): Promise<PatientConsentPrimitives | null> {
    const trimmed = token.trim();
    if (trimmed === '') return null;
    const consent = await this.consents.findByToken(trimmed);
    return consent ? consent.toPrimitives() : null;
  }
}
