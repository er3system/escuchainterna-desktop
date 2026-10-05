import { randomUUID } from 'node:crypto';
import { ReportSignatureRequest } from '../../domain/ReportSignatureRequest';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { ReportSignatureRequestRepository } from '../../domain/repositories/ReportSignatureRequestRepository';
import { PatientReportNotFoundError } from '../../domain/errors/PatientReportNotFoundError';

/** Puerto de verificación de supervisión (lo satisface SqliteSupervisorReader). */
export interface SupervisionChecker {
  supervises(
    supervisorUserId: string,
    supervisedUserId: string,
    organizationId?: string,
  ): Promise<boolean>;
}

/**
 * El practicante pide a su supervisor que firme un reporte que él redactó y revisó.
 * Reglas: el reporte es del practicante y está REVISADO (listo para firmar); el
 * supervisor elegido debe supervisarlo con un vínculo ACTIVO de esa organización; no
 * puede haber otra solicitud pendiente para el mismo reporte. NO firma nada: solo abre
 * la solicitud (el supervisor firma luego con SU tarjeta).
 */
export class RequestReportSignature {
  public constructor(
    private readonly requests: ReportSignatureRequestRepository,
    /** Repo de reportes acotado al PRACTICANTE (dueño del reporte). */
    private readonly reports: PatientReportRepository,
    private readonly supervision: SupervisionChecker,
  ) {}

  public async execute(input: {
    reportId: string;
    patientId: string;
    requesterUserId: string;
    supervisorUserId: string;
    organizationId: string;
    note: string;
  }): Promise<string> {
    const report = await this.reports.findById(input.reportId);
    if (!report || !report.belongsTo(input.patientId)) {
      throw new PatientReportNotFoundError(input.reportId);
    }
    if (report.isSigned()) {
      throw new Error('El reporte ya está firmado.');
    }
    if (report.toPrimitives().status !== 'revisado') {
      throw new Error('Marca el reporte como revisado antes de pedir la firma de tu supervisor.');
    }
    if (
      !(await this.supervision.supervises(
        input.supervisorUserId,
        input.requesterUserId,
        input.organizationId,
      ))
    ) {
      throw new Error('La persona elegida no es un supervisor activo de tu cuenta.');
    }
    if (await this.requests.findPendingByReport(input.reportId)) {
      throw new Error('Ya hay una solicitud de firma pendiente para este reporte.');
    }

    const request = ReportSignatureRequest.open({
      id: randomUUID(),
      reportId: input.reportId,
      patientId: input.patientId,
      requesterUserId: input.requesterUserId,
      supervisorUserId: input.supervisorUserId,
      organizationId: input.organizationId,
      note: input.note,
    });
    await this.requests.save(request);
    return request.requestId();
  }
}
