import { DomainError } from '@/shared/domain/DomainError';

export class ReportNotReviewedError extends DomainError {
  public constructor(reportId: string, message?: string) {
    super(
      message ??
        `El reporte ${reportId} no puede firmarse: marca primero la casilla "He revisado este contenido".`,
    );
  }
}
