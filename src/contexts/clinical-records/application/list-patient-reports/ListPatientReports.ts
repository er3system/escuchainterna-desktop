import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { PatientReportPrimitives } from '../../domain/PatientReport';

export class ListPatientReports {
  public constructor(private readonly reports: PatientReportRepository) {}

  public async execute(patientId: string): Promise<PatientReportPrimitives[]> {
    const reports = await this.reports.listByPatient(patientId);
    return reports.map((report) => report.toPrimitives());
  }
}
