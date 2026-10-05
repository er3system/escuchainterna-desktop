import { randomBytes, randomUUID } from 'node:crypto';
import { PatientConsent, type PatientConsentPrimitives } from '../../domain/PatientConsent';
import { ConsentAlreadySignedError } from '../../domain/errors/ConsentAlreadySignedError';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import type { PatientFileStorage } from '../../domain/PatientFileStorage';
import { composeConsentSnapshot } from '../issue-patient-consent/composeConsentSnapshot';
import type { AttachPaperConsentMessage } from './AttachPaperConsentMessage';

/**
 * «Adjuntar consentimiento firmado» (v3 §2 paso 3): guarda la foto/escaneo en
 * data/uploads/<patientId>/ y deja el consentimiento en 'papel_adjunto'.
 * Si había una liga pendiente (o revocada) se adjunta sobre ella; si el
 * paciente no tenía consentimiento emitido se crea uno con el snapshot actual.
 */
export class AttachPaperConsent {
  public constructor(
    private readonly consents: PatientConsentRepository,
    private readonly templates: ConsentTemplateRepository,
    private readonly patients: PatientDirectory,
    private readonly professional: ProfessionalIdentityReader,
    private readonly storage: PatientFileStorage,
  ) {}

  public async execute(message: AttachPaperConsentMessage): Promise<PatientConsentPrimitives> {
    const patientId = message.patientId();

    let consent = await this.consents.findLatestByPatient(patientId);
    // La regla se valida ANTES de tocar disco para no dejar archivos huérfanos.
    if (consent && consent.toPrimitives().status === 'firmado') {
      throw new ConsentAlreadySignedError();
    }
    if (!consent) {
      const snapshot = await composeConsentSnapshot(this.templates, this.patients, this.professional, patientId);
      consent = PatientConsent.issue({
        id: randomUUID(),
        patientId,
        token: randomBytes(24).toString('base64url'),
        templateTitle: snapshot.title,
        templateBody: snapshot.body,
      });
    }

    const storedName = `consentimiento-firmado-${new Date().toISOString().slice(0, 10)}-${message.filename()}`;
    const storedPath = await this.storage.save(patientId, storedName, message.data());
    consent.attachPaper(storedPath);
    await this.consents.save(consent);
    return consent.toPrimitives();
  }
}
