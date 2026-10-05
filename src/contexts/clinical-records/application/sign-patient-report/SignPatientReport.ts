import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import { PatientReportNotFoundError } from '../../domain/errors/PatientReportNotFoundError';
import { ProfessionalLicenseRequiredError } from '../../domain/errors/ProfessionalLicenseRequiredError';
import type { SignPatientReportMessage } from './SignPatientReportMessage';

/**
 * Firma un reporte revisado. La identidad del firmante (nombre + tarjeta
 * profesional) NO viene del cliente: se resuelve aquí desde el PERFIL del
 * usuario autenticado y se exige tarjeta profesional registrada. Un practicante
 * sin licencia no puede emitir un documento firmado por su cuenta (debe pedir la
 * firma de su supervisor). Solo un reporte firmado se imprime sin la marca de
 * agua BORRADOR (spec v2 §7).
 */
export class SignPatientReport {
  public constructor(
    private readonly reports: PatientReportRepository,
    private readonly identity: ProfessionalIdentityReader,
  ) {}

  public async execute(message: SignPatientReportMessage): Promise<void> {
    const report = await this.reports.findById(message.reportId());
    if (!report || !report.belongsTo(message.patientId())) {
      throw new PatientReportNotFoundError(message.reportId());
    }

    const profile = await this.identity.read();
    if (!profile || profile.professionalLicense.trim() === '') {
      throw new ProfessionalLicenseRequiredError();
    }

    report.sign({
      signedBy: profile.fullName,
      licenseNumber: profile.professionalLicense,
      signedByUserId: message.signerUserId(),
    });
    await this.reports.save(report);
  }
}
