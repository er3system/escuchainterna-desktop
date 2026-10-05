import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import { PatientReportNotFoundError } from '../../domain/errors/PatientReportNotFoundError';
import { SignedReportIsImmutableError } from '../../domain/errors/SignedReportIsImmutableError';

/** Elimina borradores; un reporte FIRMADO es un documento legal y se conserva. */
export class DeletePatientReport {
  public constructor(private readonly reports: PatientReportRepository) {}

  public async execute(reportId: string, patientId: string): Promise<void> {
    const report = await this.reports.findById(reportId);
    if (!report || !report.belongsTo(patientId)) {
      throw new PatientReportNotFoundError(reportId);
    }
    if (report.isSigned()) throw new SignedReportIsImmutableError(reportId);
    await this.reports.delete(reportId);
  }
}
