import { ConsentNotFoundError } from '../../domain/errors/ConsentNotFoundError';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';

/** Revoca la liga pública pendiente de un paciente (v3 §2: token revocable). */
export class RevokePatientConsent {
  public constructor(private readonly consents: PatientConsentRepository) {}

  public async execute(patientId: string): Promise<void> {
    const consent = await this.consents.findLatestByPatient(patientId);
    if (!consent || !consent.belongsTo(patientId)) throw new ConsentNotFoundError();
    consent.revoke();
    await this.consents.save(consent);
  }
}
