import { randomBytes, randomUUID } from 'node:crypto';
import { isMinor } from '@/contexts/patients/domain/value-objects/minor';
import { AI_CONSENT_MARKER } from '../../domain/value-objects/defaultConsentBody';
import { PatientConsent, type PatientConsentPrimitives } from '../../domain/PatientConsent';
import { ConsentAlreadySignedError } from '../../domain/errors/ConsentAlreadySignedError';
import { MinorRequiresGuardianError } from '../../domain/errors/MinorRequiresGuardianError';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import { composeConsentSnapshot } from './composeConsentSnapshot';

export interface IssuedConsent {
  consent: PatientConsentPrimitives;
  /** true cuando ya existía una liga pendiente y solo se actualizó el reenvío. */
  resent: boolean;
  patientName: string;
}

/**
 * «Enviar consentimiento» (v3 §2 paso 1): crea el consentimiento con token
 * único y snapshot de la plantilla. Si ya hay una liga pendiente la reutiliza
 * (reenvío); si el paciente ya firmó, no se emite otra.
 */
export class IssuePatientConsent {
  public constructor(
    private readonly consents: PatientConsentRepository,
    private readonly templates: ConsentTemplateRepository,
    private readonly patients: PatientDirectory,
    private readonly professional: ProfessionalIdentityReader,
  ) {}

  public async execute(patientId: string): Promise<IssuedConsent> {
    // Ley 1581 / Código Civil: el consentimiento de un MENOR lo otorga su representante
    // legal (acudiente). Si el paciente es menor y no hay acudiente registrado, NO se
    // emite (antes degradaba en silencio a un consentimiento de adulto que el propio
    // menor firmaba → documento jurídicamente nulo). Se valida ANTES de emitir o reenviar.
    const summary = await this.patients.findSummary(patientId);
    if (summary && isMinor(summary.birthDate) && summary.guardianName.trim() === '') {
      throw new MinorRequiresGuardianError();
    }

    const latest = await this.consents.findLatestByPatient(patientId);
    if (latest && latest.isGranted()) throw new ConsentAlreadySignedError();

    if (latest && latest.isPending()) {
      latest.markResent();
      await this.consents.save(latest);
      const patient = await this.patients.findSummary(patientId);
      return {
        consent: latest.toPrimitives(),
        resent: true,
        patientName: patient ? patient.fullName : '',
      };
    }

    const snapshot = await composeConsentSnapshot(this.templates, this.patients, this.professional, patientId);
    const consent = PatientConsent.issue({
      id: randomUUID(),
      patientId,
      // Token URL-safe e impredecible: ES la credencial de la página pública.
      token: randomBytes(24).toString('base64url'),
      templateTitle: snapshot.title,
      templateBody: snapshot.body,
      // Finalidad-IA congelada según el cuerpo de ESTE consentimiento: si la plantilla del
      // profesional conserva la cláusula de IA, el paciente la autoriza al firmar; si la quitó, no.
      aiAuthorized: snapshot.body.toLowerCase().includes(AI_CONSENT_MARKER),
    });
    await this.consents.save(consent);
    return { consent: consent.toPrimitives(), resent: false, patientName: snapshot.patientName };
  }
}
