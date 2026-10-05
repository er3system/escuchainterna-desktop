import { DomainError } from '@/shared/domain/DomainError';

export class PatientReportNotFoundError extends DomainError {
  public constructor(reportId: string) {
    super(`No se encontró el reporte ${reportId}.`);
  }
}
