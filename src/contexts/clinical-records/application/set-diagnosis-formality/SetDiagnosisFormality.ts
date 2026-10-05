import type { DiagnosisKind } from '../../domain/Diagnosis';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import { DiagnosisNotFoundError } from '../../domain/errors/DiagnosisNotFoundError';
import { ProfessionalLicenseRequiredError } from '../../domain/errors/ProfessionalLicenseRequiredError';

/**
 * Cambia la naturaleza de un diagnóstico:
 * - a 'formal' = es una AFIRMACIÓN clínico-legal y exige tarjeta profesional en el
 *   perfil del usuario (mismo principio que la firma); el responsable queda atado al
 *   usuario en sesión (no repudio).
 * - a 'hipotesis' = acto conservador (degradar la afirmación), sin gate de licencia.
 */
export class SetDiagnosisFormality {
  public constructor(
    private readonly diagnoses: DiagnosisRepository,
    private readonly identity: ProfessionalIdentityReader,
  ) {}

  public async execute(input: {
    diagnosisId: string;
    patientId: string;
    kind: DiagnosisKind;
    actorUserId: string;
  }): Promise<void> {
    const diagnosis = await this.diagnoses.findById(input.diagnosisId);
    if (!diagnosis || !diagnosis.belongsTo(input.patientId)) {
      throw new DiagnosisNotFoundError(input.diagnosisId);
    }

    if (input.kind === 'formal') {
      const profile = await this.identity.read();
      if (!profile || profile.professionalLicense.trim() === '') {
        throw new ProfessionalLicenseRequiredError();
      }
      diagnosis.confirmAsFormal({ confirmedByUserId: input.actorUserId });
    } else {
      diagnosis.revertToHypothesis();
    }

    await this.diagnoses.save(diagnosis);
  }
}
