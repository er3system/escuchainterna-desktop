import { DomainError } from '@/shared/domain/DomainError';

export class SignedReportIsImmutableError extends DomainError {
  public constructor(reportId: string) {
    super(`El reporte ${reportId} ya está firmado y no puede modificarse.`);
  }
}
