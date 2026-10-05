import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import type { ReportSignatureRequestRepository } from '../../domain/repositories/ReportSignatureRequestRepository';
import { PatientReportNotFoundError } from '../../domain/errors/PatientReportNotFoundError';
import { ProfessionalLicenseRequiredError } from '../../domain/errors/ProfessionalLicenseRequiredError';
import { SignatureRequestNotFoundError } from '../../domain/errors/SignatureRequestNotFoundError';
import type { SupervisionChecker } from './RequestReportSignature';

/**
 * El supervisor firma el reporte de su supervisado en respuesta a una solicitud.
 *
 * ESCRITURA CROSS-OWNER (rompe la regla de oro owner_user_id): el reporte pertenece al
 * practicante, pero lo firma el supervisor con SU tarjeta. Por eso va triplemente
 * gateada: (1) debe existir una solicitud PENDIENTE dirigida a este supervisor; (2) el
 * vínculo de supervisión debe seguir ACTIVO AHORA (no solo cuando se pidió); (3) el
 * supervisor debe tener tarjeta profesional. El reporte queda firmado a nombre del
 * supervisor (no repudio: signedByUserId = supervisor).
 */
export class SignRequestedReport {
  public constructor(
    private readonly requests: ReportSignatureRequestRepository,
    /** Construye el repo de reportes acotado al dueño dado (el practicante). */
    private readonly reportsFor: (ownerUserId: string) => PatientReportRepository,
    /** Construye el lector de identidad para el usuario dado (el supervisor). */
    private readonly identityFor: (userId: string) => ProfessionalIdentityReader,
    private readonly supervision: SupervisionChecker,
  ) {}

  public async execute(input: { requestId: string; supervisorUserId: string }): Promise<void> {
    const request = await this.requests.findById(input.requestId);
    if (!request || !request.isPending() || !request.addressedTo(input.supervisorUserId)) {
      throw new SignatureRequestNotFoundError();
    }

    // (2) El vínculo debe seguir vigente EN ESTE MOMENTO (no solo al solicitar): si el
    // supervisado fue dado de baja o el vínculo revocado, el supervisor ya no firma.
    if (
      !(await this.supervision.supervises(
        input.supervisorUserId,
        request.requester(),
        request.organization(),
      ))
    ) {
      throw new Error('Ya no supervisas a esta persona, no puedes firmar su reporte.');
    }

    // (3) El supervisor firma con SU tarjeta profesional (gate de licencia).
    const profile = await this.identityFor(input.supervisorUserId).read();
    if (!profile || profile.professionalLicense.trim() === '') {
      throw new ProfessionalLicenseRequiredError();
    }

    // Reporte del PRACTICANTE (cross-owner): se acota el repo a su owner_user_id.
    const reports = this.reportsFor(request.requester());
    const report = await reports.findById(request.report());
    if (!report || !report.belongsTo(request.patient())) {
      throw new PatientReportNotFoundError(request.report());
    }

    report.sign({
      signedBy: profile.fullName,
      licenseNumber: profile.professionalLicense,
      signedByUserId: input.supervisorUserId,
    });
    await reports.save(report);

    request.markSigned();
    await this.requests.save(request);
  }
}
