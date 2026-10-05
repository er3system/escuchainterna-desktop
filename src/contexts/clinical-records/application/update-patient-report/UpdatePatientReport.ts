import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import { PatientReportNotFoundError } from '../../domain/errors/PatientReportNotFoundError';
import type { UpdatePatientReportMessage } from './UpdatePatientReportMessage';

/** Edita un reporte no firmado; el checkbox de revisión vive en el agregado. */
export class UpdatePatientReport {
  public constructor(private readonly reports: PatientReportRepository) {}

  public async execute(message: UpdatePatientReportMessage): Promise<void> {
    const report = await this.reports.findById(message.reportId());
    if (!report || !report.belongsTo(message.patientId())) {
      throw new PatientReportNotFoundError(message.reportId());
    }
    report.edit({ title: message.title(), content: message.content(), reviewed: message.reviewed() });
    await this.reports.save(report);
  }
}
