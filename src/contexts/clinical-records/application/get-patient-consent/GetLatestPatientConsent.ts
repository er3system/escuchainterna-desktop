import type { PatientConsentPrimitives } from '../../domain/PatientConsent';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';

/** Estado vigente del consentimiento de un paciente (badge del Resumen, banner de Historia). */
export class GetLatestPatientConsent {
  public constructor(private readonly consents: PatientConsentRepository) {}

  public async execute(patientId: string): Promise<PatientConsentPrimitives | null> {
    const consent = await this.consents.findLatestByPatient(patientId);
    return consent ? consent.toPrimitives() : null;
  }
}
